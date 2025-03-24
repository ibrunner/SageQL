import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { GraphQLSchema, parse, validate, buildClientSchema } from "graphql";
import { config } from "dotenv";
import { z } from "zod";
import {
  QUERY_BUILDER_PROMPT,
  QUERY_BUILDER_PROMPT_TEMPLATE,
} from "../prompts/agent/query-builder.js";
// Load environment variables
config();

// Environment schema
const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
  OPENAI_API_BASE: z.string().url("OpenAI API base URL is required"),
  OPENAI_MODEL: z.string().optional(),
});

// Validate environment variables
const env = envSchema.parse(process.env);

export interface QueryBuilderState {
  messages: BaseMessage[];
  schema: string;
  currentQuery?: string;
  validationErrors?: string[];
}

function extractGraphQLQuery(response: string): string {
  // First try to find a code block with graphql language specifier
  const graphqlBlock = response.match(/```graphql\n([\s\S]*?)```/);
  if (graphqlBlock) {
    return graphqlBlock[1].trim();
  }

  // Then try to find any code block
  const codeBlock = response.match(/```\n([\s\S]*?)```/);
  if (codeBlock) {
    return codeBlock[1].trim();
  }

  // If no code blocks found, return the entire response trimmed
  return response.trim();
}

function validateGraphQLQuery(
  query: string,
  schema: GraphQLSchema,
): { isValid: boolean; errors?: string[] } {
  try {
    const ast = parse(query);
    const validationErrors = validate(schema, ast);

    if (validationErrors.length > 0) {
      return {
        isValid: false,
        errors: validationErrors.map((error) => error.message),
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      errors: [
        error instanceof Error ? error.message : "Unknown validation error",
      ],
    };
  }
}

export class QueryBuilderAgent {
  private model: ChatOpenAI;
  private prompt: ChatPromptTemplate;
  private verbose: boolean;

  constructor(
    modelName: string = env.OPENAI_MODEL || "gpt-4-turbo-preview",
    verbose: boolean = false,
  ) {
    this.model = new ChatOpenAI({
      modelName,
      temperature: 0.1,
      openAIApiKey: env.OPENAI_API_KEY,
      configuration: {
        baseURL: env.OPENAI_API_BASE,
      },
    });
    this.verbose = verbose;

    this.prompt = ChatPromptTemplate.fromMessages([
      ["system", QUERY_BUILDER_PROMPT_TEMPLATE],
      new MessagesPlaceholder("messages"),
    ]);
  }

  async generateQuery(
    request: string,
    schema: string,
  ): Promise<{ query: string; errors?: string[] }> {
    if (this.verbose) console.log("\n=== Generating Query ===");
    if (this.verbose) console.log("Request:", request);
    if (this.verbose) console.log("Schema:", schema);

    const state: QueryBuilderState = {
      messages: [],
      schema,
    };

    if (this.verbose) console.log("\n=== Invoking Model ===");
    const formattedPrompt = await this.prompt.format({
      schema,
      messages: [new HumanMessage(request)],
    });
    if (this.verbose) console.log("Formatted prompt:", formattedPrompt);

    const response = await this.model.invoke(formattedPrompt);
    if (this.verbose) console.log("Model execution completed");
    if (this.verbose) console.log("Raw response:", response);

    // Extract the query from the response
    const extractedQuery = extractGraphQLQuery(
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content),
    );
    if (this.verbose) console.log("Extracted query:", extractedQuery);

    // Parse the schema for validation
    const parsedSchema = buildClientSchema(JSON.parse(schema));

    // Validate the extracted query
    const validation = validateGraphQLQuery(extractedQuery, parsedSchema);
    if (this.verbose) {
      console.log("Validation result:", validation);
    }

    return {
      query: extractedQuery,
      errors: validation.errors,
    };
  }
}
