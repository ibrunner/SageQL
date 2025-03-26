import { config } from "dotenv";
import { createQueryChain } from "../workflows/queryChain.js";
import { QueryChainState } from "../workflows/queryChain.js";
import { loadLatestSchema } from "../lib/schema.js";
import { runQueryChainWithRetry } from "../workflows/runQueryChainWithRetry.js";
import { getMessageString } from "../lib/getMessageString.js";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { llmEnv, llmModel } from "../lib/llmClient.js";
import { RESPONSE_FORMATTER_PROMPT } from "../agents/prompts/responseFormatter.js";
import { logger } from "@/lib/logger.js";

config();

/**
 * Main entry point for the query execution script
 * Handles the complete workflow of:
 * - Loading GraphQL schema
 * - Creating and executing query graph
 * - Processing results
 * - Generating natural language response
 * @throws {Error} If any step in the process fails
 */
async function main() {
  try {
    const { query } = parseArgs();

    logger.debug("\n=== Starting Query Process ===");
    logger.debug("Input query:", query);

    // Load the schema
    logger.debug("\n=== Loading Schema ===");
    const schemaJson = loadLatestSchema();
    logger.debug("Schema JSON loaded successfully");

    // Create the query graph
    logger.debug("\n=== Creating Query Graph ===");
    const chain = await createQueryChain(llmEnv.GRAPHQL_API_URL);
    logger.debug("Query chain created successfully");

    // Initialize the graph state
    logger.debug("\n=== Initializing Graph State ===");
    const initialState: QueryChainState = {
      messages: [query],
      schema: schemaJson,
      currentQuery: "",
      validationErrors: [],
      executionResult: null,
    };
    logger.debug("Initial state:", JSON.stringify(initialState, null, 2));

    // Run the graph
    logger.debug("\n=== Running Query Graph ===");
    const result = await runQueryChainWithRetry(chain, initialState, 3);
    logger.debug("Graph execution completed");

    // Generate natural language response
    logger.debug("\n=== Generating Natural Language Response ===");

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", RESPONSE_FORMATTER_PROMPT],
      new MessagesPlaceholder("messages"),
    ]);

    const response = await llmModel.invoke(
      await prompt.format({
        queryResults: JSON.stringify(result.executionResult, null, 2),
        question: query,
        messages: [new HumanMessage(query)],
      }),
    );

    // Output the results
    logger.info("\n=== Results ===");
    logger.info("\nGenerated Query:");
    logger.info(result.currentQuery);

    if (result.validationErrors?.length) {
      logger.error("\nValidation Errors:");
      result.validationErrors.forEach((error) => logger.error(`- ${error}`));
    }

    logger.info("\nResponse:");
    logger.info(getMessageString(response.content));
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

/**
 * Parses command line arguments for the query script
 * @returns {Object} Object containing the query string
 * @property {string} query - The GraphQL query to execute
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const query = args.find((arg) => !arg.startsWith("--"));

  if (!query) {
    console.error("Please provide a query as a command line argument");
    process.exit(1);
  }

  return { query };
}
