import { config } from "dotenv";
import { createQueryGraph } from "../agents/graph.js";
import { GraphState } from "../agents/graph.js";
import { loadLatestSchema } from "../lib/schema.js";
import { buildClientSchema } from "graphql";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { RESPONSE_FORMATTER_PROMPT } from "./prompts/response-formatter.js";

config();

// Environment schema
const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
  OPENAI_API_BASE: z.string().url("OpenAI API base URL is required"),
  OPENAI_MODEL: z.string().optional(),
  GRAPHQL_API_URL: z.string().url("GraphQL API URL is required"),
});

// Validate environment variables
const env = envSchema.parse(process.env);

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

async function runQueryWithRetry(
  graph: any,
  initialState: GraphState,
  maxRetries: number = 3,
  verbose: boolean = false,
): Promise<GraphState> {
  let currentState = initialState;
  let attempt = 1;

  while (attempt <= maxRetries) {
    if (verbose) {
      console.log(`\n=== Attempt ${attempt}/${maxRetries} ===`);
      if (attempt > 1) {
        console.log("Previous query:", currentState.currentQuery);
        console.log("Previous errors:", currentState.validationErrors);
      }
    }

    try {
      const result = await graph.invoke(currentState);

      if (result.validationErrors?.length) {
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

          currentState = {
            ...currentState,
            messages: [
              ...currentState.messages.slice(0, 1), // Keep the original query
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
              `Original request:`,
              currentState.messages[0],
            ],
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
        currentState = {
          ...currentState,
          messages: [
            ...currentState.messages.slice(0, 1), // Keep the original query
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
    const { query, verbose } = parseArgs();

    if (verbose) {
      console.log("\n=== Starting Query Process ===");
      console.log("Input query:", query);
    }

    // Load the schema
    if (verbose) console.log("\n=== Loading Schema ===");
    const schemaJson = loadLatestSchema();
    if (verbose) console.log("Schema JSON loaded successfully");

    if (verbose) console.log("\n=== Building GraphQL Schema ===");
    const schema = buildClientSchema(JSON.parse(schemaJson));
    if (verbose) console.log("GraphQL Schema built successfully");

    // Create the query graph
    if (verbose) console.log("\n=== Creating Query Graph ===");
    const graph = await createQueryGraph(env.GRAPHQL_API_URL, verbose);
    if (verbose) console.log("Query graph created successfully");

    // Initialize the graph state
    if (verbose) console.log("\n=== Initializing Graph State ===");
    const initialState: GraphState = {
      messages: [query],
      schema,
      currentQuery: "",
      validationErrors: [],
      executionResult: null,
    };
    if (verbose)
      console.log("Initial state:", JSON.stringify(initialState, null, 2));

    // Run the graph
    if (verbose) console.log("\n=== Running Query Graph ===");
    const result = await runQueryWithRetry(graph, initialState, 3, verbose);
    if (verbose) console.log("Graph execution completed");

    // Generate natural language response
    if (verbose) console.log("\n=== Generating Natural Language Response ===");
    const model = new ChatOpenAI({
      modelName: env.OPENAI_MODEL || "gpt-4-turbo-preview",
      temperature: 0.7,
      openAIApiKey: env.OPENAI_API_KEY,
      configuration: {
        baseURL: env.OPENAI_API_BASE,
      },
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", RESPONSE_FORMATTER_PROMPT],
      new MessagesPlaceholder("messages"),
    ]);

    const response = await model.invoke(
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
