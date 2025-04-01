import { Tool } from "@langchain/core/tools";
import { z } from "zod";
import { schemaListLookup } from "../lib/graphql/schema-lookup/schema-lookup.js";
import { LookupRequest } from "../lib/graphql/schema-lookup/types.js";
import { logger } from "../lib/logger.js";

const schemaLookupInputSchema = z.object({
  requests: z.array(
    z.object({
      lookup: z.enum(["type", "field", "relationships", "search"]),
      id: z.string().optional(),
      typeId: z.string().optional(),
      fieldId: z.string().optional(),
      query: z.string().optional(),
      limit: z.number().optional(),
    }),
  ),
});

export class SchemaLookupTool extends Tool {
  name = "schema_lookup";
  description =
    "Look up multiple schema items at once. Useful for gathering all necessary schema information before building a query.";

  private schemaData: any;

  constructor(schema: any) {
    super();
    this.schemaData = schema;
  }

  protected async _call(input: z.infer<typeof schemaLookupInputSchema>) {
    logger.debug("Schema Lookup Tool - Input:", input);

    try {
      const result = schemaListLookup(
        this.schemaData,
        input.requests as LookupRequest[],
      );
      logger.debug("Schema Lookup Tool - Result:", {
        requestCount: input.requests.length,
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
      return JSON.parse(val.input);
    });
}
