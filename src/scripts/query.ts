import { config } from "dotenv";
import { createQueryChain } from "../workflows/chain.js";
import { ChainState } from "../workflows/chain.js";
import { loadLatestSchema } from "../lib/schema.js";
import { runQueryWithRetry } from "../agents/runQueryWithRetry.js";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { llmEnv, llmModel } from "../lib/llmClient.js";
import { RESPONSE_FORMATTER_PROMPT } from "../agents/prompts/responseFormatter.js";

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
    const { query, verbose } = parseArgs();

    if (verbose) {
      console.log("\n=== Starting Query Process ===");
      console.log("Input query:", query);
    }

    // Load the schema
    if (verbose) console.log("\n=== Loading Schema ===");
    const schemaJson = loadLatestSchema();
    if (verbose) console.log("Schema JSON loaded successfully");

    // Create the query graph
    if (verbose) console.log("\n=== Creating Query Graph ===");
    const chain = await createQueryChain(llmEnv.GRAPHQL_API_URL, verbose);
    if (verbose) console.log("Query chain created successfully");

    // Initialize the graph state
    if (verbose) console.log("\n=== Initializing Graph State ===");
    const initialState: ChainState = {
      messages: [query],
      schema: schemaJson,
      currentQuery: "",
      validationErrors: [],
      executionResult: null,
    };
    if (verbose)
      console.log("Initial state:", JSON.stringify(initialState, null, 2));

    // Run the graph
    if (verbose) console.log("\n=== Running Query Graph ===");
    const result = await runQueryWithRetry(chain, initialState, 3, verbose);
    if (verbose) console.log("Graph execution completed");

    // Generate natural language response
    if (verbose) console.log("\n=== Generating Natural Language Response ===");

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
    console.log("\n=== Results ===");
    console.log("\nGenerated Query:");
    console.log(result.currentQuery);

    if (result.validationErrors?.length) {
      console.log("\nValidation Errors:");
      result.validationErrors.forEach((error) => console.log(`- ${error}`));
    }

    console.log("\nResponse:");
    console.log(response.content);
  } catch (error: unknown) {
    console.error("\n=== Error Occurred ===");
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    } else {
      console.error("Unknown error:", error);
    }
    process.exit(1);
  }
}

main();

/**
 * Parses command line arguments for the query script
 * @returns {Object} Object containing the query string and verbose flag
 * @property {string} query - The GraphQL query to execute
 * @property {boolean} verbose - Flag indicating whether to output verbose logs
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose");
  const query = args.find((arg) => !arg.startsWith("--"));

  if (!query) {
    console.error("Please provide a query as a command line argument");
    process.exit(1);
  }

  return { query, verbose };
}
