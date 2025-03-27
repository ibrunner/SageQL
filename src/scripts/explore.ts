import { config } from "dotenv";
import { createQueryGraph, QueryGraphState } from "../workflows/queryGraph.js";
import { loadLatestSchema } from "../lib/graphql/loadLatestSchema.js";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { llmModel, llmEnv } from "../lib/llmClient.js";
import { RESPONSE_FORMATTER_PROMPT } from "../agents/prompts/responseFormatter.js";
import { EXPLORE_PROMPT } from "./prompts/explore.js";
import { logger } from "../lib/logger.js";
import { getMessageString } from "../lib/getMessageString.js";

config();

function parseArgs() {
  const args = process.argv.slice(2);
  const numQueries = parseInt(
    args.find((arg) => arg.startsWith("--queries="))?.split("=")[1] || "3",
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
    const schemaJson = loadLatestSchema();
    logger.info("Schema JSON loaded successfully");

    // Create the query graph
    logger.info("\n=== Creating Query Graph ===");
    const graph = await createQueryGraph(llmEnv.GRAPHQL_API_URL);
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
          schema: schemaJson,
          messages: [],
          agent_scratchpad: "",
        }),
      );

      // Initialize the graph state
      const initialState: QueryGraphState = {
        messages: [explorationResponse.content.toString()],
        schema: schemaJson,
        currentQuery: "",
        validationErrors: [],
        executionResult: null,
        retryCount: 0,
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
