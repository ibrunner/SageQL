import { SCHEMA_ANALYSIS_PROMPT } from "./prompts/schema-analysis.js";
import { LookupRequest } from "../lib/graphql/schema-lookup/types.js";
import { logger } from "../lib/logger.js";
import { llmModel } from "../lib/llm-client.js";
import { schemaListLookup } from "../lib/graphql/schema-lookup/schema-lookup.js";

const schemaLookupFunction = {
  name: "lookup_schema",
  description: "Look up schema information based on a list of lookup requests",
  parameters: {
    type: "object",
    properties: {
      requests: {
        type: "array",
        items: {
          type: "object",
          properties: {
            lookup: {
              type: "string",
              enum: ["type", "field", "relationships"],
              description: "The type of lookup to perform",
            },
            id: {
              type: "string",
              description: "The type ID for type lookups",
            },
            typeId: {
              type: "string",
              description: "The type ID for field and relationship lookups",
            },
            fieldId: {
              type: "string",
              description: "The field ID for field lookups",
            },
          },
          required: ["lookup"],
          additionalProperties: false,
        },
      },
    },
    required: ["requests"],
  },
};

/**
 * Analyzes a user query to determine what schema information is needed and retrieves it
 * @param query The user's query/request
 * @param schema The full GraphQL schema
 * @returns The schema context containing all needed information
 */
export async function analyzeAndLookupSchema(
  query: string,
  schema: any,
): Promise<any> {
  logger.info("\n=== Schema Analysis Step ===");
  logger.info("Analyzing query:", query);

  try {
    const chain = SCHEMA_ANALYSIS_PROMPT.pipe(
      llmModel.bind({
        functions: [schemaLookupFunction],
        function_call: { name: "lookup_schema" },
      }),
    );

    logger.info("Invoking schema analysis chain...");
    const response = await chain.invoke({
      userQuery: query,
      tools: [
        {
          function: schemaLookupFunction,
          handler: async (args: { requests: LookupRequest[] }) => {
            logger.info("\n=== Schema Lookup Step ===");
            logger.info(
              "Lookup Requests:",
              JSON.stringify(args.requests, null, 2),
            );

            const result = schemaListLookup(schema, args.requests);
            logger.info(
              "Lookup Results:",
              JSON.stringify(
                {
                  types: Object.keys(result.types || {}),
                  fields: Object.keys(result.fields || {}),
                  relationships: Object.keys(result.relationships || {}),
                  metadata: result.metadata,
                },
                null,
                2,
              ),
            );

            return JSON.stringify(result);
          },
        },
      ],
    });

    // Extract the function call result
    const functionResponse =
      response.additional_kwargs.function_call?.arguments;
    if (!functionResponse) {
      throw new Error("No schema lookup response received");
    }

    const parsedResponse = JSON.parse(functionResponse);
    logger.info("\n=== Schema Analysis Results ===");
    logger.info(
      "Generated Schema Context:",
      JSON.stringify(
        {
          requestedTypes: Object.keys(parsedResponse.types || {}),
          requestedFields: Object.keys(parsedResponse.fields || {}),
          requestedRelationships: Object.keys(
            parsedResponse.relationships || {},
          ),
          metadata: parsedResponse.metadata,
        },
        null,
        2,
      ),
    );

    return parsedResponse;
  } catch (error) {
    logger.error("\n=== Schema Analysis Error ===");
    logger.error("Error details:", error);
    throw error;
  }
}
