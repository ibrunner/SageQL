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

// Types for GraphQL schema elements
export interface GraphQLType {
  __typename?: string;
  kind: string;
  name: string;
  description?: string;
  fields?: GraphQLField[] | null;
  interfaces?: GraphQLType[] | null;
  enumValues?: GraphQLEnumValue[] | null;
  possibleTypes?: GraphQLType[] | null;
  ofType?: GraphQLType | null;
}

export interface GraphQLField {
  __typename?: string;
  name: string;
  description?: string;
  args?: GraphQLInputValue[];
  type: GraphQLType;
  isDeprecated?: boolean;
  deprecationReason?: any;
}

export interface GraphQLInputValue {
  __typename?: string;
  name: string;
  description?: string;
  type: GraphQLType;
  defaultValue?: any;
}

export interface GraphQLEnumValue {
  __typename?: string;
  name: string;
  description?: string;
  isDeprecated?: boolean;
  deprecationReason?: any;
}

export interface GraphQLSchema {
  __schema: {
    types: GraphQLType[];
    queryType: { name: string };
    mutationType?: any;
    subscriptionType?: any;
    directives?: any[];
  };
}

// Types for lookup responses
export interface TypeLookupResponse extends GraphQLType {}

export interface FieldLookupResponse extends GraphQLField {}

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
export const graphQLInputValueSchema = z.object({
  __typename: z.string().optional(),
  name: z.string(),
  description: z.union([z.string(), z.null()]).optional(),
  type: z.lazy(() => graphQLTypeSchema),
  defaultValue: z.any().optional(),
});

export const graphQLEnumValueSchema = z.object({
  __typename: z.string().optional(),
  name: z.string(),
  description: z.union([z.string(), z.null()]).optional(),
  isDeprecated: z.boolean().optional(),
  deprecationReason: z.any().optional(),
});

export const graphQLFieldSchema = z.object({
  __typename: z.string().optional(),
  name: z.string(),
  description: z.union([z.string(), z.null()]).optional(),
  args: z.array(graphQLInputValueSchema).optional().default([]),
  type: z.lazy(() => graphQLTypeSchema),
  isDeprecated: z.boolean().optional(),
  deprecationReason: z.any().optional(),
});

// Input type for schema validation
interface GraphQLTypeInput extends Omit<GraphQLType, "name"> {
  name: string | null;
}

// Base schema for GraphQL types
const baseGraphQLTypeSchema = z.object({
  __typename: z.string().optional(),
  kind: z.string(),
  name: z.union([z.string(), z.null()]),
  description: z.union([z.string(), z.null()]).optional(),
  fields: z.array(graphQLFieldSchema).nullable().optional(),
  interfaces: z
    .array(z.lazy(() => graphQLTypeSchema))
    .nullable()
    .optional(),
  enumValues: z.array(graphQLEnumValueSchema).nullable().optional(),
  possibleTypes: z
    .array(z.lazy(() => graphQLTypeSchema))
    .nullable()
    .optional(),
  ofType: z
    .lazy(() => graphQLTypeSchema)
    .nullable()
    .optional(),
});

export const graphQLTypeSchema: z.ZodType<GraphQLType> = z.lazy(
  () => baseGraphQLTypeSchema as z.ZodType<GraphQLType>,
);

export const graphQLSchemaSchema = z.object({
  __schema: z.object({
    types: z.array(graphQLTypeSchema),
    queryType: z.object({ name: z.string() }),
    mutationType: z.any().optional(),
    subscriptionType: z.any().optional(),
    directives: z.array(z.any()).optional(),
  }),
});

export interface MergedLookupResponse {
  types: Record<string, TypeLookupResponse>;
  fields: Record<string, FieldLookupResponse>;
  relationships: Record<string, RelationshipsLookupResponse>;
  searchResults: SearchResult[];
  metadata: {
    requestOrder: Array<{ type: LookupType; id: string }>;
    relatedTypes: Set<string>;
  };
}
