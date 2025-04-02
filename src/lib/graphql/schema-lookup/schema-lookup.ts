import {
  LookupRequest,
  LookupResponse,
  TypeLookupResponse,
  FieldLookupResponse,
  RelationshipsLookupResponse,
  SearchLookupResponse,
  graphQLSchemaSchema,
  GraphQLSchema,
  GraphQLType,
  SearchResult,
  LookupType,
  MergedLookupResponse,
} from "./types.js";
import { logger } from "../../logger.js";

/**
 * Validates a GraphQL schema against the expected format
 * @param schema The schema to validate
 * @returns The validated schema with proper typing
 * @throws {ZodError} If the schema is invalid
 */
function validateSchema(schema: unknown): GraphQLSchema {
  logger.debug("Schema Validation - Input schema structure:", {
    hasSchema: !!schema,
    schemaType: typeof schema,
    hasIntrospection: !!(schema as any)?.__schema,
    typeCount: (schema as any)?.__schema?.types?.length,
  });

  const validated = graphQLSchemaSchema.parse(schema);
  logger.debug("Schema Validation - Validated schema:", {
    typeCount: validated.__schema.types.length,
    queryType: validated.__schema.queryType?.name,
    types: validated.__schema.types.map((t) => t.name),
  });

  return validated;
}

/**
 * Helper function to get the concrete type name from a GraphQL type
 * Handles NON_NULL and LIST wrappers
 */
function getConcreteTypeName(type: GraphQLType): string {
  if (type.kind === "NON_NULL" || type.kind === "LIST") {
    return type.ofType ? getConcreteTypeName(type.ofType) : "";
  }
  return type.name || "";
}

/**
 * Schema lookup function that provides access to schema information
 * @param schema The full GraphQL schema to look up information from
 * @param request The lookup request specifying what information to retrieve
 * @returns The requested schema information
 */
const schemaLookup = (
  schema: unknown,
  request: LookupRequest,
): LookupResponse => {
  logger.debug("Schema Lookup - Processing request:", {
    requestType: request.lookup,
    requestDetails: request,
  });

  // Validate schema before use
  const validatedSchema = validateSchema(schema);
  const typeMap = new Map(
    validatedSchema.__schema.types
      .filter((t): t is GraphQLType & { name: string } => t.name !== null)
      .map((t) => [t.name, t]),
  );

  logger.debug("Schema Lookup - Type map created:", {
    typeCount: typeMap.size,
    availableTypes: Array.from(typeMap.keys()),
  });

  let response: LookupResponse;
  switch (request.lookup) {
    case "type":
      response = lookupType(typeMap, request.id);
      logger.debug("Schema Lookup - Type lookup result:", {
        requestedType: request.id,
        found: !!response,
        typeKind: (response as TypeLookupResponse)?.kind,
        fieldCount: (response as TypeLookupResponse)?.fields?.length,
      });
      return response;

    case "field":
      response = lookupField(typeMap, request.typeId, request.fieldId);
      logger.debug("Schema Lookup - Field lookup result:", {
        type: request.typeId,
        field: request.fieldId,
        found: !!response,
        fieldType: (response as FieldLookupResponse)?.type?.name,
      });
      return response;

    case "relationships":
      response = lookupRelationships(typeMap, request.typeId);
      logger.debug("Schema Lookup - Relationships lookup result:", {
        type: request.typeId,
        outgoingCount: Object.keys(
          (response as RelationshipsLookupResponse).outgoing,
        ).length,
        incomingCount: Object.keys(
          (response as RelationshipsLookupResponse).incoming,
        ).length,
      });
      return response;

    // case "search":
    //   response = searchSchema(
    //     validatedSchema.__schema.types,
    //     request.query,
    //     request.limit,
    //   );
    //   logger.debug("Schema Lookup - Search result:", {
    //     query: request.query,
    //     limit: request.limit,
    //     resultCount: (response as SearchLookupResponse).results.length,
    //     topResults: (response as SearchLookupResponse).results
    //       .slice(0, 3)
    //       .map((r) => ({
    //         path: r.path,
    //         relevance: r.relevance,
    //       })),
    //   });
    //   return response;

    case "pattern":
      throw new Error(
        "Pattern lookup is not supported on full schema - use compressed schema for patterns",
      );
    default:
      throw new Error(`Unsupported lookup type: ${(request as any).lookup}`);
  }
};

// Helper function to look up a type
function lookupType(
  typeMap: Map<string, GraphQLType>,
  typeId: string,
): TypeLookupResponse {
  const type = typeMap.get(typeId);
  if (!type) {
    throw new Error(`Type not found: ${typeId}`);
  }
  return type;
}

// Helper function to look up a field
function lookupField(
  typeMap: Map<string, GraphQLType>,
  typeId: string,
  fieldId: string,
): FieldLookupResponse {
  const type = typeMap.get(typeId);
  if (!type) {
    throw new Error(`Type not found: ${typeId}`);
  }

  const field = type.fields?.find((f) => f.name === fieldId);
  if (!field) {
    throw new Error(`Field not found: ${fieldId} on type ${typeId}`);
  }

  return field;
}

// Helper function to look up relationships
function lookupRelationships(
  typeMap: Map<string, GraphQLType>,
  typeId: string,
): RelationshipsLookupResponse {
  const outgoing: Record<string, string> = {};
  const incoming: Record<string, string> = {};

  // Find outgoing relationships (fields on this type that reference other types)
  const type = typeMap.get(typeId);
  if (type?.fields) {
    for (const field of type.fields) {
      const fieldType = getConcreteTypeName(field.type);
      if (typeMap.has(fieldType) && typeMap.get(fieldType)?.kind === "OBJECT") {
        outgoing[field.name] = fieldType;
      }
    }
  }

  // Find incoming relationships (fields on other types that reference this type)
  for (const [otherTypeId, otherType] of typeMap.entries()) {
    if (otherTypeId === typeId || otherType.kind !== "OBJECT") continue;

    for (const field of otherType.fields || []) {
      const fieldType = getConcreteTypeName(field.type);
      if (fieldType === typeId) {
        incoming[`${otherTypeId}.${field.name}`] = otherTypeId;
      }
    }
  }

  return { outgoing, incoming };
}

// Helper function to search the schema
function searchSchema(
  types: GraphQLType[],
  query: string,
  limit: number = 5,
): SearchLookupResponse {
  logger.debug("Schema Search - Processing query:", {
    query,
    limit,
    typeCount: types.length,
  });

  const results: SearchResult[] = [];
  const searchTerms = query.toLowerCase().split(" ");
  const relatedTypes = new Set<string>();

  // Helper to calculate relevance score
  const calculateRelevance = (text: string, description?: string): number => {
    let score = 0;
    const lowerText = text.toLowerCase();

    for (const term of searchTerms) {
      if (lowerText.includes(term)) score += 0.5;
      if (description?.toLowerCase().includes(term)) score += 0.3;
    }

    return Math.min(score, 1);
  };

  // Search through types
  for (const type of types) {
    if (type.name?.startsWith("__")) continue; // Skip introspection types

    const relevance = calculateRelevance(type.name, type.description);
    if (relevance > 0) {
      results.push({
        path: type.name,
        type: type.kind,
        description: type.description,
        relevance,
      });
      relatedTypes.add(type.name);

      // If this is an object type, also add its fields
      if (type.kind === "OBJECT" && type.fields) {
        for (const field of type.fields) {
          const fieldRelevance = calculateRelevance(
            field.name,
            field.description,
          );
          if (fieldRelevance > 0) {
            results.push({
              path: `${type.name}.${field.name}`,
              type: getConcreteTypeName(field.type),
              description: field.description,
              relevance: fieldRelevance,
            });
            relatedTypes.add(type.name);
            relatedTypes.add(getConcreteTypeName(field.type));
          }
        }
      }
    }

    // Search through fields even if type itself isn't relevant
    if (type.kind === "OBJECT" && type.fields) {
      for (const field of type.fields) {
        const fieldRelevance = calculateRelevance(
          field.name,
          field.description,
        );
        if (fieldRelevance > 0) {
          results.push({
            path: `${type.name}.${field.name}`,
            type: getConcreteTypeName(field.type),
            description: field.description,
            relevance: fieldRelevance,
          });
          relatedTypes.add(type.name);
          relatedTypes.add(getConcreteTypeName(field.type));
        }
      }
    }
  }

  // Sort by relevance and limit results
  const sortedResults = results
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);

  logger.debug("Schema Search - Results:", {
    query,
    resultCount: sortedResults.length,
    relatedTypes: Array.from(relatedTypes),
    topResults: sortedResults.slice(0, 3).map((r) => ({
      path: r.path,
      relevance: r.relevance,
    })),
  });

  return {
    results: sortedResults,
    relatedTypes: Array.from(relatedTypes),
  };
}

function getRequestId(request: LookupRequest): string {
  switch (request.lookup) {
    case "type":
      return request.id;
    case "field":
      return `${request.typeId}.${request.fieldId}`;
    case "relationships":
      return request.typeId;
    case "pattern":
      return request.patternName;
    case "search":
      return request.query;
  }
}

export function schemaListLookup(
  schema: unknown,
  requests: LookupRequest[],
): MergedLookupResponse {
  const merged: MergedLookupResponse = {
    types: {},
    fields: {},
    relationships: {},
    searchResults: [],
    metadata: {
      requestOrder: [],
      relatedTypes: new Set(),
      errors: [], // Track errors per request
    },
  };
  logger.info("=== Schema List Lookup ===");
  logger.info(JSON.stringify(requests, null, 2));
  logger.info("=== End Schema List Lookup ===");

  // Validate schema once for all requests
  const validatedSchema = validateSchema(schema);
  const typeMap = new Map(
    validatedSchema.__schema.types
      .filter((t): t is GraphQLType & { name: string } => t.name !== null)
      .map((t) => [t.name, t]),
  );

  // Helper to add a type and its fields to the merged response
  const addTypeToMerged = (typeName: string) => {
    if (!merged.types[typeName] && typeMap.has(typeName)) {
      const type = typeMap.get(typeName)!;
      merged.types[typeName] = type;
      merged.metadata.relatedTypes.add(typeName);

      // If this is an object type, also add its fields
      if (type.kind === "OBJECT" && type.fields) {
        type.fields.forEach((field) => {
          const fieldKey = `${typeName}.${field.name}`;
          if (!merged.fields[fieldKey]) {
            merged.fields[fieldKey] = field;
          }
        });
      }
    }
  };

  for (const request of requests) {
    try {
      switch (request.lookup) {
        case "type":
          const typeResult = lookupType(typeMap, request.id);
          merged.types[request.id] = typeResult;
          merged.metadata.requestOrder.push({
            type: request.lookup,
            id: request.id,
            success: true,
          });
          merged.metadata.relatedTypes.add(request.id);
          break;
        case "field":
          const fieldResult = lookupField(
            typeMap,
            request.typeId,
            request.fieldId,
          );
          const fieldKey = `${request.typeId}.${request.fieldId}`;
          merged.fields[fieldKey] = fieldResult;
          merged.metadata.requestOrder.push({
            type: request.lookup,
            id: fieldKey,
            success: true,
          });
          merged.metadata.relatedTypes.add(request.typeId);

          // Add the field's return type and its fields to the response
          const returnTypeName = getConcreteTypeName(fieldResult.type);
          if (returnTypeName) {
            addTypeToMerged(returnTypeName);
            logger.debug("Added return type for field lookup:", {
              field: fieldKey,
              returnType: returnTypeName,
              returnTypeKind: typeMap.get(returnTypeName)?.kind,
              returnTypeFields: typeMap
                .get(returnTypeName)
                ?.fields?.map((f) => f.name),
            });
          }
          break;
        case "relationships":
          const relationshipsResult = lookupRelationships(
            typeMap,
            request.typeId,
          );
          merged.relationships[request.typeId] = relationshipsResult;
          merged.metadata.requestOrder.push({
            type: request.lookup,
            id: request.typeId,
            success: true,
          });
          merged.metadata.relatedTypes.add(request.typeId);
          // Add related types from relationships and their fields
          Object.values(relationshipsResult.outgoing).forEach(addTypeToMerged);
          Object.values(relationshipsResult.incoming).forEach(addTypeToMerged);
          break;
      }
    } catch (error) {
      logger.error(`Error processing request ${request.lookup}:`, error);
      // Record the error but continue processing other requests
      merged.metadata.errors.push({
        request,
        error: error instanceof Error ? error.message : String(error),
      });
      merged.metadata.requestOrder.push({
        type: request.lookup,
        id: getRequestId(request),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Add success/failure summary to metadata
  merged.metadata.summary = {
    total: requests.length,
    successful: requests.length - merged.metadata.errors.length,
    failed: merged.metadata.errors.length,
    hasPartialResults:
      merged.metadata.errors.length > 0 &&
      merged.metadata.errors.length < requests.length,
  };

  logger.info("=== Schema List Lookup Results ===");
  logger.info("Summary:", merged.metadata.summary);
  logger.info("Errors:", merged.metadata.errors);
  logger.info("Results:", {
    types: Object.keys(merged.types),
    fields: Object.keys(merged.fields),
    relationships: Object.keys(merged.relationships),
  });
  logger.info("=== End Schema List Lookup ===");

  return merged;
}

export default schemaLookup;
