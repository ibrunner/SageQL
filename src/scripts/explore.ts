import { config } from "dotenv";
import { createQueryChain } from "../workflows/chain.js";
import { ChainState } from "../workflows/chain.js";
import { loadLatestSchema } from "../lib/schema.js";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { llmModel, llmEnv } from "../lib/llmClient.js";
import { RESPONSE_FORMATTER_PROMPT } from "../agents/prompts/responseFormatter.js";
import { EXPLORE_PROMPT } from "./prompts/explore.js";
import { logger } from "../lib/logger.js";
import { getMessageString } from "../agents/runQueryWithRetry.js";

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

async function runQueryWithRetry(
  graph: any,
  initialState: ChainState,
  maxRetries: number = 3,
): Promise<ChainState> {
  let currentState = initialState;
  let attempt = 1;

  while (attempt <= maxRetries) {
    logger.debug(`\n=== Attempt ${attempt}/${maxRetries} ===`);
    if (attempt > 1) {
      logger.debug("Previous query:", currentState.currentQuery);
      logger.debug("Previous errors:", currentState.validationErrors);
    }

    try {
      const result = await graph.invoke(currentState);

      if (result.validationErrors?.length) {
        logger.error("\nValidation Errors:");
        result.validationErrors.forEach((error: string) =>
          logger.error(`- ${error}`),
        );

        if (attempt < maxRetries) {
          logger.info("\nRetrying with updated context...");
          currentState = {
            ...currentState,
            messages: [
              ...currentState.messages,
              `Previous query failed with errors: ${result.validationErrors.join(", ")}`,
              `Current query was: ${result.currentQuery}`,
              "Please fix the validation errors and try again",
            ],
            validationErrors: [],
          };
          attempt++;
          continue;
        }
      }

      return result;
    } catch (error) {
      logger.error("\nExecution Error:");
      if (error instanceof Error) {
        logger.error(`- ${error.message}`);
      } else {
        logger.error(`- ${error}`);
      }

      if (attempt < maxRetries) {
        logger.info("\nRetrying with updated context...");
        currentState = {
          ...currentState,
          messages: [
            ...currentState.messages,
            `Previous query failed with error: ${error instanceof Error ? error.message : String(error)}`,
            `Current query was: ${currentState.currentQuery}`,
            "Please fix the query and try again",
          ],
          validationErrors: [],
        };
        attempt++;
        continue;
      }
      throw error;
    }
  }

  throw new Error("Max retries reached without successful validation");
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
    const graph = await createQueryChain(llmEnv.GRAPHQL_API_URL);
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
      const initialState: ChainState = {
        messages: [explorationResponse.content.toString()],
        schema: schemaJson,
        currentQuery: "",
        validationErrors: [],
        executionResult: null,
      };

      // Run the query
      const result = await runQueryWithRetry(graph, initialState, 3);

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
