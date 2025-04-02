import { config } from "dotenv";
import {
  createCompressedQueryGraph,
  CompressedQueryGraphState,
} from "../workflows/compressed-query-graph.js";
import { loadLatestSchema } from "../lib/graphql/load-latest-schema.js";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { llmModel, llmEnv } from "../lib/llm-client.js";
import { RESPONSE_FORMATTER_PROMPT } from "../agents/prompts/response-formatter.js";
import { EXPLORE_PROMPT } from "./prompts/explore.js";
import { logger } from "../lib/logger.js";
import { getMessageString } from "../lib/get-message-string.js";
import schemaCompressor from "../lib/graphql/schema-compressor/schema-compressor.js";
config();

function parseArgs() {
  const args = process.argv.slice(2);
  const numQueries = parseInt(
    args.find((arg) => arg.startsWith("--queries="))?.split("=")[1] || "1",
  );

  if (numQueries < 1) {
    console.error("Number of queries must be at least 1");
    process.exit(1);
  }

  return { numQueries };
}

async function main() {
  try {
    const { numQueries } = parseArgs();

    logger.info("\n=== Starting API Exploration ===");
    logger.info(`Number of queries to generate: ${numQueries}`);

    // Load the schema
    logger.info("\n=== Loading Schema ===");
    const rawSchema = loadLatestSchema();
    const schemaJson = JSON.parse(rawSchema);
    logger.info("Schema loaded successfully");

    // Create the compressed schema
    logger.info("\n=== Compressing Schema ===");
    const compressedSchema = await schemaCompressor(schemaJson);
    logger.info("Schema compressed successfully");

    // Create the query graph
    logger.info("\n=== Creating Query Graph ===");
    const graph = await createCompressedQueryGraph(
      llmEnv.GRAPHQL_API_URL,
      compressedSchema,
      schemaJson,
    );
    logger.info("Query graph created successfully");

    const explorationPrompt = ChatPromptTemplate.fromMessages([
      ["system", EXPLORE_PROMPT],
      new MessagesPlaceholder("messages"),
    ]);

    // Generate and execute queries
    for (let i = 0; i < numQueries; i++) {
      logger.info(`\n=== Query ${i + 1}/${numQueries} ===`);

      // Generate an interesting query
      const explorationResponse = await llmModel.invoke(
        await explorationPrompt.format({
          schema: compressedSchema,
          messages: [],
          agent_scratchpad: "",
        }),
      );

      // Initialize the graph state
      const initialState: CompressedQueryGraphState = {
        messages: [explorationResponse.content.toString()],
        schema: schemaJson,
        compressedSchema,
        currentQuery: "",
        validationErrors: [],
        executionResult: null,
        schemaAnalysisRetries: 0,
        queryGenerationRetries: 0,
        validationRetries: 0,
        executionRetries: 0,
        schemaContext: null,
        lookupRequests: [],
        lookupResults: {
          success: false,
          context: null,
          errors: [],
        },
      };

      // Run the query graph
      const result = await graph.invoke(initialState);

      // Format the response using the existing formatter
      const responsePrompt = ChatPromptTemplate.fromMessages([
        ["system", RESPONSE_FORMATTER_PROMPT],
        new MessagesPlaceholder("messages"),
      ]);

      const formattedResponse = await llmModel.invoke(
        await responsePrompt.format({
          queryResults: JSON.stringify(result.executionResult, null, 2),
          question: explorationResponse.content.toString(),
          messages: [new HumanMessage(explorationResponse.content.toString())],
        }),
      );

      // Output the results
      logger.info("\nGenerated Query:");
      logger.info(result.currentQuery);

      if (result.validationErrors?.length) {
        logger.info("\nValidation Errors:");
        result.validationErrors.forEach((error: string) =>
          logger.info(`- ${error}`),
        );
      }

      logger.info("\nResponse:");
      logger.info(getMessageString(formattedResponse.content));
    }
  } catch (error: unknown) {
    logger.error("\n=== Error Occurred ===");
    if (error instanceof Error) {
      logger.error("Error name:", error.name);
      logger.error("Error message:", error.message);
      logger.error("Error stack:", error.stack);
    } else {
      logger.error("Unknown error:", error);
    }
    process.exit(1);
  }
}

main();
