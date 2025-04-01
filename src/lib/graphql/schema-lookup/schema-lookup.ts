import { z } from "zod";

// Types for lookup requests
export type LookupType =
  | "type"
  | "field"
  | "relationships"
  | "search"
  | "pattern";

export interface TypeLookupRequest {
  lookup: "type";
  id: string;
}

export interface FieldLookupRequest {
  lookup: "field";
  typeId: string;
  fieldId: string;
}

export interface RelationshipsLookupRequest {
  lookup: "relationships";
  typeId: string;
}

export interface SearchLookupRequest {
  lookup: "search";
  query: string;
  limit?: number;
}

export interface PatternLookupRequest {
  lookup: "pattern";
  patternName: string;
  params: Record<string, string>;
}

export type LookupRequest =
  | TypeLookupRequest
  | FieldLookupRequest
  | RelationshipsLookupRequest
  | SearchLookupRequest
  | PatternLookupRequest;

// Types for schema elements
export interface SchemaField {
  name: string;
  type: string;
  description?: string;
  args?: Array<{
    name: string;
    type: string;
    default?: string;
  }>;
}

export interface SchemaType {
  kind: string;
  name: string;
  description?: string;
  fields?: SchemaField[];
  interfaces?: string[];
  enumValues?: Array<{
    name: string;
    description?: string;
  }>;
}

export interface SchemaPattern {
  fields: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
}

export interface CompressedSchema {
  types: Record<string, SchemaType>;
  _patterns?: Record<string, SchemaPattern>;
}

// Types for lookup responses
export interface TypeLookupResponse {
  kind: string;
  name: string;
  description?: string;
  fields?: Array<{
    name: string;
    type: string;
    description?: string;
    args?: Array<{
      name: string;
      type: string;
      default?: string;
    }>;
  }>;
  interfaces?: string[];
  enumValues?: Array<{
    name: string;
    description?: string;
  }>;
}

export interface FieldLookupResponse {
  name: string;
  type: string;
  description?: string;
  args?: Array<{
    name: string;
    type: string;
    default?: string;
  }>;
}

export interface RelationshipsLookupResponse {
  outgoing: Record<string, string>;
  incoming: Record<string, string>;
}

export interface SearchResult {
  path: string;
  type: string;
  description?: string;
  relevance: number;
}

export interface SearchLookupResponse {
  results: SearchResult[];
}

export interface PatternLookupResponse {
  kind: string;
  fields: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
}

export type LookupResponse =
  | TypeLookupResponse
  | FieldLookupResponse
  | RelationshipsLookupResponse
  | SearchLookupResponse
  | PatternLookupResponse;

// Schema validation with Zod
const schemaFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  args: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        default: z.string().optional(),
      }),
    )
    .optional(),
});

const schemaTypeSchema = z.object({
  kind: z.string(),
  name: z.string(),
  description: z.string().optional(),
  fields: z.array(schemaFieldSchema).optional(),
  interfaces: z.array(z.string()).optional(),
  enumValues: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
});

const schemaPatternSchema = z.object({
  fields: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      description: z.string().optional(),
    }),
  ),
});

const compressedSchemaSchema = z.object({
  types: z.record(schemaTypeSchema),
  _patterns: z.record(schemaPatternSchema).optional(),
  queryType: z.string().optional(),
  mutationType: z.string().optional(),
  subscriptionType: z.string().optional(),
  directives: z
    .array(
      z.object({
        name: z.string(),
        locations: z.array(z.string()).optional(),
        args: z
          .array(
            z.object({
              name: z.string(),
              type: z.string(),
              default: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

/**
 * Validates a compressed schema against the expected format
 * @param schema The schema to validate
 * @returns The validated schema with proper typing
 * @throws {ZodError} If the schema is invalid
 */
function validateCompressedSchema(schema: unknown): CompressedSchema {
  return compressedSchemaSchema.parse(schema);
}

/**
 * Schema lookup function that provides access to compressed schema information
 * @param schema The compressed schema to look up information from
 * @param request The lookup request specifying what information to retrieve
 * @returns The requested schema information
 */
const schemaLookup = (
  schema: unknown,
  request: LookupRequest,
): LookupResponse => {
  // Validate schema before use
  const validatedSchema = validateCompressedSchema(schema);

  switch (request.lookup) {
    case "type":
      return lookupType(validatedSchema, request.id);
    case "field":
      return lookupField(validatedSchema, request.typeId, request.fieldId);
    case "relationships":
      return lookupRelationships(validatedSchema, request.typeId);
    case "search":
      return searchSchema(validatedSchema, request.query, request.limit);
    case "pattern":
      return lookupPattern(
        validatedSchema,
        request.patternName,
        request.params,
      );
    default:
      throw new Error(`Unsupported lookup type: ${(request as any).lookup}`);
  }
};

// Helper function to look up a type
function lookupType(
  schema: CompressedSchema,
  typeId: string,
): TypeLookupResponse {
  const type = schema.types[typeId];
  if (!type) {
    throw new Error(`Type not found: ${typeId}`);
  }
  return type;
}

// Helper function to look up a field
function lookupField(
  schema: CompressedSchema,
  typeId: string,
  fieldId: string,
): FieldLookupResponse {
  const type = schema.types[typeId];
  if (!type) {
    throw new Error(`Type not found: ${typeId}`);
  }

  const field = type.fields?.find((f: SchemaField) => f.name === fieldId);
  if (!field) {
    throw new Error(`Field not found: ${fieldId} on type ${typeId}`);
  }

  return field;
}

// Helper function to look up relationships
function lookupRelationships(
  schema: CompressedSchema,
  typeId: string,
): RelationshipsLookupResponse {
  const outgoing: Record<string, string> = {};
  const incoming: Record<string, string> = {};

  // Find outgoing relationships (fields on this type that reference other types)
  const type = schema.types[typeId];
  if (type?.fields) {
    for (const field of type.fields) {
      const fieldType = field.type.replace(/[\[\]!]/g, ""); // Remove [] and ! from type
      if (schema.types[fieldType]) {
        outgoing[field.name] = fieldType;
      }
    }
  }

  // Find incoming relationships (fields on other types that reference this type)
  for (const [otherTypeId, otherType] of Object.entries(schema.types)) {
    if (otherTypeId === typeId) continue;

    for (const field of otherType.fields || []) {
      const fieldType = field.type.replace(/[\[\]!]/g, "");
      if (fieldType === typeId) {
        incoming[`${otherTypeId}.${field.name}`] = otherTypeId;
      }
    }
  }

  return { outgoing, incoming };
}

// Helper function to search the schema
function searchSchema(
  schema: CompressedSchema,
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
  for (const [typeId, type] of Object.entries(schema.types)) {
    const relevance = calculateRelevance(typeId, type.description);
    if (relevance > 0) {
      results.push({
        path: typeId,
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
          path: `${typeId}.${field.name}`,
          type: field.type,
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

// Helper function to look up and apply a pattern
function lookupPattern(
  schema: CompressedSchema,
  patternName: string,
  params: Record<string, string>,
): PatternLookupResponse {
  const pattern = schema._patterns?.[patternName];
  if (!pattern) {
    throw new Error(`Pattern not found: ${patternName}`);
  }

  // Apply pattern parameters
  const fields = pattern.fields.map((field) => ({
    ...field,
    type: field.type.replace(
      /\{(\w+)\}/g,
      (_: string, param: string) => params[param] || param,
    ),
  }));

  return {
    kind: "OBJECT",
    fields,
  };
}

export default schemaLookup;
