import { config } from "dotenv";
import { createQueryChain } from "../agents/chain.js";
import { ChainState } from "../agents/chain.js";
import { loadLatestSchema } from "../lib/schema.js";

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { llmEnv, llmModel } from "../lib/llmClient.js";
import { RESPONSE_FORMATTER_PROMPT } from "../prompts/agent/responseFormatter.js";

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

/**
 * Executes a GraphQL query with automatic retry logic for validation errors
 * @param {any} graph - The LangGraph instance for query execution
 * @param {ChainState} initialState - Initial state containing query and schema information
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {boolean} verbose - Flag for detailed logging output (default: false)
 * @returns {Promise<ChainState>} Final state after query execution
 * @throws {Error} When max retries are reached without successful validation
 */
async function runQueryWithRetry(
  graph: any,
  initialState: ChainState,
  maxRetries: number = 3,
  verbose: boolean = false,
): Promise<ChainState> {
  let currentState = initialState;
  let attempt = 1;

  while (attempt <= maxRetries) {
    if (verbose) {
      console.log(`\n=== Attempt ${attempt}/${maxRetries} ===`);
      if (attempt > 1) {
        console.log("Previous query:", currentState.currentQuery);
        console.log("Previous errors:", currentState.validationErrors);
        console.log("Current messages:", currentState.messages);
      }
    }

    try {
      const result = await graph.invoke(currentState);

      // Check for validation errors first
      if (result.validationErrors?.length > 0) {
        console.log("\nValidation Errors:");
        result.validationErrors.forEach((error: string) =>
          console.log(`- ${error}`),
        );

        if (attempt < maxRetries) {
          console.log("\nRetrying with updated context...");

          // Analyze validation errors to provide better guidance
          const fieldNameErrors = result.validationErrors.filter(
            (error: string) =>
              error.includes("Cannot query field") ||
              error.includes("Did you mean"),
          );
          const argumentErrors = result.validationErrors.filter(
            (error: string) =>
              error.includes("argument") || error.includes("Unknown argument"),
          );
          const typeErrors = result.validationErrors.filter(
            (error: string) =>
              error.includes("type") && !error.includes("field"),
          );
          const filterErrors = result.validationErrors.filter(
            (error: string) =>
              error.includes("filter") || error.includes("input"),
          );

          // Extract field name suggestions from errors
          const fieldSuggestions = fieldNameErrors
            .map((error: string) => {
              const suggestionMatch = error.match(/Did you mean "([^"]+)"\?/);
              return suggestionMatch ? suggestionMatch[1] : null;
            })
            .filter(Boolean);

          // Extract field names that need to be replaced
          const fieldsToReplace = fieldNameErrors
            .map((error: string) => {
              const fieldMatch = error.match(/Cannot query field "([^"]+)"/);
              return fieldMatch ? fieldMatch[1] : null;
            })
            .filter(Boolean);

          const retryContext = [
            currentState.messages[0], // Keep the original request
            `The previous query failed with validation errors. Please fix these issues while maintaining the original query intent:`,
            ...(fieldNameErrors.length > 0
              ? [
                  `Field Name Errors:`,
                  ...fieldNameErrors.map((error: string) => `- ${error}`),
                  ...(fieldSuggestions.length > 0
                    ? [
                        `Suggested field names to use:`,
                        ...fieldSuggestions.map(
                          (suggestion: string) => `- ${suggestion}`,
                        ),
                      ]
                    : []),
                  `Please use ONLY the exact field names from the schema. Do not guess or abbreviate field names.`,
                ]
              : []),
            ...(argumentErrors.length > 0
              ? [
                  `Argument Errors:`,
                  ...argumentErrors.map((error: string) => `- ${error}`),
                  `Please use ONLY the arguments defined in the schema.`,
                ]
              : []),
            ...(typeErrors.length > 0
              ? [
                  `Type Errors:`,
                  ...typeErrors.map((error: string) => `- ${error}`),
                  `Please ensure all field types match the schema exactly.`,
                ]
              : []),
            ...(filterErrors.length > 0
              ? [
                  `Filter Errors:`,
                  ...filterErrors.map((error: string) => `- ${error}`),
                  `Please ensure filters follow these guidelines:`,
                  `1. Use standard two-letter codes for continents (e.g., "EU" for Europe)`,
                  `2. Use ISO codes for countries and languages`,
                  `3. Follow the exact filter structure from the schema`,
                  `4. Check the schema for the correct filter input type`,
                ]
              : []),
            `Previous query that failed:`,
            currentState.currentQuery,
            `Please generate a new query that:`,
            `1. Maintains the original query intent`,
            `2. Uses ONLY the exact field names from the schema`,
            `3. Includes ONLY fields that are directly relevant to the request`,
            `4. Uses ONLY the arguments defined in the schema`,
            `5. Follows proper GraphQL syntax`,
            `6. Keeps the same field selection structure`,
            ...(fieldSuggestions.length > 0
              ? [
                  `7. Uses the suggested field names where applicable`,
                  `8. Replaces any incorrect field names with their correct versions from the schema`,
                ]
              : []),
            ...(filterErrors.length > 0
              ? [
                  `9. Uses the correct filter codes and structures`,
                  `10. Follows the filter guidelines for continents, countries, and languages`,
                ]
              : []),
            `Schema context:`,
            JSON.stringify(currentState.schema, null, 2),
          ];

          if (verbose) {
            console.log("\nRetry context being sent to model:");
            console.log(retryContext.join("\n"));
          }

          currentState = {
            ...currentState,
            messages: retryContext,
            validationErrors: [],
          };
          attempt++;
          continue;
        }
      }

      return result;
    } catch (error) {
      console.log("\nExecution Error:");
      if (error instanceof Error) {
        console.log(`- ${error.message}`);
      } else {
        console.log(`- ${error}`);
      }

      if (attempt < maxRetries) {
        console.log("\nRetrying with updated context...");
        const retryContext = [
          currentState.messages[0], // Keep the original request
          `The previous query failed with an execution error. Please review and fix the issues:`,
          `Error: ${error instanceof Error ? error.message : String(error)}`,
          `Previous query that failed:`,
          currentState.currentQuery,
          `Please generate a new query that:`,
          `1. Uses ONLY the exact field names from the schema`,
          `2. Includes ONLY fields that are directly relevant to the request`,
          `3. Uses ONLY the arguments defined in the schema`,
          `4. Maintains the original intent of the query`,
          `5. Follows proper GraphQL syntax`,
          `Schema context:`,
          JSON.stringify(currentState.schema, null, 2),
        ];

        if (verbose) {
          console.log("\nRetry context being sent to model:");
          console.log(retryContext.join("\n"));
        }

        currentState = {
          ...currentState,
          messages: retryContext,
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
