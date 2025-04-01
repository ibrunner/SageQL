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
} from "./types.js";

/**
 * Validates a GraphQL schema against the expected format
 * @param schema The schema to validate
 * @returns The validated schema with proper typing
 * @throws {ZodError} If the schema is invalid
 */
function validateSchema(schema: unknown): GraphQLSchema {
  return graphQLSchemaSchema.parse(schema);
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
  // Validate schema before use
  const validatedSchema = validateSchema(schema);
  const typeMap = new Map(
    validatedSchema.__schema.types
      .filter((t): t is GraphQLType & { name: string } => t.name !== null)
      .map((t) => [t.name, t]),
  );

  switch (request.lookup) {
    case "type":
      return lookupType(typeMap, request.id);
    case "field":
      return lookupField(typeMap, request.typeId, request.fieldId);
    case "relationships":
      return lookupRelationships(typeMap, request.typeId);
    case "search":
      return searchSchema(
        validatedSchema.__schema.types,
        request.query,
        request.limit,
      );
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
  const results: SearchResult[] = [];
  const searchTerms = query.toLowerCase().split(" ");

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
    }

    // Search through fields
    for (const field of type.fields || []) {
      const fieldRelevance = calculateRelevance(field.name, field.description);
      if (fieldRelevance > 0) {
        results.push({
          path: `${type.name}.${field.name}`,
          type: getConcreteTypeName(field.type),
          description: field.description,
          relevance: fieldRelevance,
        });
      }
    }
  }

  // Sort by relevance and limit results
  return {
    results: results.sort((a, b) => b.relevance - a.relevance).slice(0, limit),
  };
}

export default schemaLookup;
