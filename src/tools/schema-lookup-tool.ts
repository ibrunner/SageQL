import { Tool } from "@langchain/core/tools";
import { z } from "zod";
import { schemaListLookup } from "../lib/graphql/schema-lookup/schema-lookup.js";
import {
  LookupRequest,
  GraphQLSchema,
} from "../lib/graphql/schema-lookup/types.js";
import { logger } from "../lib/logger.js";

// Define the Zod schema for individual lookup requests
const lookupRequestSchema = z.discriminatedUnion("lookup", [
  z.object({
    lookup: z.literal("type"),
    id: z.string(),
  }),
  z.object({
    lookup: z.literal("field"),
    typeId: z.string(),
    fieldId: z.string(),
  }),
  z.object({
    lookup: z.literal("relationships"),
    typeId: z.string(),
  }),
]);

// Schema for the entire input
const schemaLookupInputSchema = z.object({
  requests: z.array(lookupRequestSchema),
});

export class SchemaLookupTool extends Tool {
  name = "schema_lookup";
  description =
    "Look up multiple schema items at once. Useful for gathering all necessary schema information before building a query.";

  private schemaData: GraphQLSchema;

  constructor(schema: GraphQLSchema) {
    super();
    this.schemaData = schema;
    logger.debug("Schema Lookup Tool - Initialized with schema:", {
      hasSchema: !!schema,
      schemaType: typeof schema,
    });
  }

  protected async _call(input: string) {
    logger.debug("Schema Lookup Tool - Input:", input);

    try {
      // Parse and validate the input
      const parsedInput = JSON.parse(input);
      const requests = Array.isArray(parsedInput)
        ? parsedInput
        : parsedInput.requests;

      // Validate schema
      if (!this.schemaData?.__schema) {
        throw new Error("Invalid schema: missing __schema property");
      }

      // Type assertion here is safe because schemaListLookup will validate the requests
      const result = schemaListLookup(
        this.schemaData,
        requests as LookupRequest[],
      );

      logger.debug("Schema Lookup Tool - Result:", {
        requestCount: requests.length,
        typesFound: Object.keys(result.types).length,
        fieldsFound: Object.keys(result.fields).length,
        relatedTypes: Array.from(result.metadata.relatedTypes),
      });

      return JSON.stringify(result);
    } catch (error) {
      logger.error("Schema Lookup Tool - Error:", error);
      throw error;
    }
  }

  schema = z
    .object({
      input: z.string().optional(),
    })
    .transform((val) => {
      if (!val.input) return undefined;
      return val.input;
    });
}
