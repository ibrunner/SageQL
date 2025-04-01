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
  fields?: GraphQLField[];
  interfaces?: GraphQLType[];
  enumValues?: GraphQLEnumValue[];
  possibleTypes?: GraphQLType[];
  ofType?: GraphQLType;
}

export interface GraphQLField {
  __typename?: string;
  name: string;
  description?: string;
  args?: GraphQLInputValue[];
  type: GraphQLType;
  isDeprecated?: boolean;
  deprecationReason?: string | null;
}

export interface GraphQLInputValue {
  __typename?: string;
  name: string;
  description?: string;
  type: GraphQLType;
  defaultValue?: string | null;
}

export interface GraphQLEnumValue {
  __typename?: string;
  name: string;
  description?: string;
  isDeprecated?: boolean;
  deprecationReason?: string | null;
}

export interface GraphQLSchema {
  __schema: {
    types: GraphQLType[];
    queryType: { name: string };
    mutationType?: { name: string } | null;
    subscriptionType?: { name: string } | null;
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
  description: z.string().optional(),
  type: z.lazy(() => graphQLTypeSchema),
  defaultValue: z.string().nullable().optional(),
});

export const graphQLEnumValueSchema = z.object({
  __typename: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  isDeprecated: z.boolean().optional(),
  deprecationReason: z.string().nullable().optional(),
});

export const graphQLFieldSchema = z.object({
  __typename: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  args: z.array(graphQLInputValueSchema).optional(),
  type: z.lazy(() => graphQLTypeSchema),
  isDeprecated: z.boolean().optional(),
  deprecationReason: z.string().nullable().optional(),
});

export const graphQLTypeSchema: z.ZodType<GraphQLType> = z.lazy(() =>
  z.object({
    __typename: z.string().optional(),
    kind: z.string(),
    name: z.string(),
    description: z.string().optional(),
    fields: z.array(graphQLFieldSchema).optional(),
    interfaces: z.array(z.lazy(() => graphQLTypeSchema)).optional(),
    enumValues: z.array(graphQLEnumValueSchema).optional(),
    possibleTypes: z.array(z.lazy(() => graphQLTypeSchema)).optional(),
    ofType: z.lazy(() => graphQLTypeSchema).optional(),
  }),
);

export const graphQLSchemaSchema = z.object({
  __schema: z.object({
    types: z.array(graphQLTypeSchema),
    queryType: z.object({ name: z.string() }),
    mutationType: z.object({ name: z.string() }).nullable().optional(),
    subscriptionType: z.object({ name: z.string() }).nullable().optional(),
    directives: z.array(z.any()).optional(),
  }),
});
