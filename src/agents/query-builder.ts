import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { GraphQLSchema, parse, validate } from "graphql";
import { getIntrospectionQuery } from "graphql";
import { config } from "dotenv";
import { z } from "zod";

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

const QUERY_BUILDER_PROMPT = `You are a GraphQL query generator tool. Your ONLY job is to generate valid GraphQL queries based on natural language requests.

IMPORTANT RULES:
1. ONLY return the GraphQL query - no explanations, no markdown, no code blocks
2. The query must be valid according to the provided schema
3. Include all necessary fields and arguments
4. Handle pagination when needed
5. Use fragments for reusable query parts

Current schema:
{schema}

{agent_scratchpad}

Generate a valid GraphQL query that satisfies this request.`;

export interface QueryBuilderState {
  messages: BaseMessage[];
  schema: GraphQLSchema;
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
  private executor!: AgentExecutor;
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
      ["system", QUERY_BUILDER_PROMPT],
      new MessagesPlaceholder("messages"),
    ]);
  }

  async initialize() {
    if (this.verbose) console.log("\n=== Initializing Query Builder Agent ===");

    const agent = await createOpenAIFunctionsAgent({
      llm: this.model,
      prompt: this.prompt,
      tools: [],
    });
    if (this.verbose) console.log("Agent created successfully");

    this.executor = AgentExecutor.fromAgentAndTools({
      agent,
      tools: [],
      verbose: this.verbose,
    });
    if (this.verbose) console.log("Agent executor created successfully");
  }

  async generateQuery(
    request: string,
    schema: GraphQLSchema,
  ): Promise<{ query: string; errors?: string[] }> {
    if (this.verbose) console.log("\n=== Generating Query ===");
    if (this.verbose) console.log("Request:", request);

    if (!this.executor) {
      await this.initialize();
    }

    const state: QueryBuilderState = {
      messages: [],
      schema,
    };

    if (this.verbose) console.log("\n=== Invoking Agent Executor ===");
    const result = await this.executor.invoke({
      input: request,
      schema: JSON.stringify(schema),
      agent_scratchpad: "",
      messages: [new HumanMessage(request)],
    });
    if (this.verbose) console.log("Agent execution completed");

    // Extract the query from the response
    const extractedQuery = extractGraphQLQuery(result.output);
    if (this.verbose) console.log("Extracted query:", extractedQuery);

    // Validate the extracted query
    const validation = validateGraphQLQuery(extractedQuery, schema);
    if (this.verbose) {
      console.log("Validation result:", validation);
    }

    return {
      query: extractedQuery,
      errors: validation.errors,
    };
  }
}
