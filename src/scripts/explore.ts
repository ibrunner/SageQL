import { config } from "dotenv";
import { createQueryChain } from "../agents/chain.js";
import { GraphState } from "../agents/chain.js";
import { loadLatestSchema } from "../lib/schema.js";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { RESPONSE_FORMATTER_PROMPT } from "../prompts/agent/response-formatter.js";
import { EXPLORE_PROMPT } from "../prompts/developer/explore.js";
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
  const numQueries = parseInt(
    args.find((arg) => arg.startsWith("--queries="))?.split("=")[1] || "3",
  );

  if (numQueries < 1) {
    console.error("Number of queries must be at least 1");
    process.exit(1);
  }

  return { verbose, numQueries };
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
    const { verbose, numQueries } = parseArgs();

    if (verbose) {
      console.log("\n=== Starting API Exploration ===");
      console.log(`Number of queries to generate: ${numQueries}`);
    }

    // Load the schema
    if (verbose) console.log("\n=== Loading Schema ===");
    const schemaJson = loadLatestSchema();
    if (verbose) console.log("Schema JSON loaded successfully");

    // Create the query graph
    if (verbose) console.log("\n=== Creating Query Graph ===");
    const graph = await createQueryChain(env.GRAPHQL_API_URL, verbose);
    if (verbose) console.log("Query graph created successfully");

    // Initialize the exploration model
    const model = new ChatOpenAI({
      modelName: env.OPENAI_MODEL || "gpt-4-turbo-preview",
      temperature: 0.7,
      openAIApiKey: env.OPENAI_API_KEY,
      configuration: {
        baseURL: env.OPENAI_API_BASE,
      },
    });

    const explorationPrompt = ChatPromptTemplate.fromMessages([
      ["system", EXPLORE_PROMPT],
      new MessagesPlaceholder("messages"),
    ]);

    // Generate and execute queries
    for (let i = 0; i < numQueries; i++) {
      console.log(`\n=== Query ${i + 1}/${numQueries} ===`);

      // Generate an interesting query
      const explorationResponse = await model.invoke(
        await explorationPrompt.format({
          schema: schemaJson,
          messages: [],
          agent_scratchpad: "",
        }),
      );

      // Initialize the graph state
      const initialState: GraphState = {
        messages: [explorationResponse.content.toString()],
        schema: schemaJson,
        currentQuery: "",
        validationErrors: [],
        executionResult: null,
      };

      // Run the query
      const result = await runQueryWithRetry(graph, initialState, 3, verbose);

      // Format the response using the existing formatter
      const responsePrompt = ChatPromptTemplate.fromMessages([
        ["system", RESPONSE_FORMATTER_PROMPT],
        new MessagesPlaceholder("messages"),
      ]);

      const formattedResponse = await model.invoke(
        await responsePrompt.format({
          queryResults: JSON.stringify(result.executionResult, null, 2),
          question: explorationResponse.content.toString(),
          messages: [new HumanMessage(explorationResponse.content.toString())],
        }),
      );

      // Output the results
      console.log("\nGenerated Query:");
      console.log(result.currentQuery);

      if (result.validationErrors?.length) {
        console.log("\nValidation Errors:");
        result.validationErrors.forEach((error: string) =>
          console.log(`- ${error}`),
        );
      }

      console.log("\nResponse:");
      console.log(formattedResponse.content);
    }
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
