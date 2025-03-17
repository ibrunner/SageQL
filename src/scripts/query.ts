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
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

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

const RESPONSE_GENERATOR_PROMPT = `You are a helpful assistant that provides natural language responses to questions about the Rick and Morty universe using GraphQL queries.

Your role is to:
1. Understand the user's question
2. Use the provided GraphQL query results to answer their question
3. Provide a clear, concise, and natural response
4. Include relevant details from the query results
5. If the query results are empty or don't contain the information needed, explain that

Current query results:
{queryResults}

User's question:
{question}

Provide a natural language response to the user's question based on the query results.`;

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
    const result = await graph.invoke(initialState);
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
      ["system", RESPONSE_GENERATOR_PROMPT],
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
