import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { GraphQLSchema, parse, validate, buildClientSchema } from "graphql";
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
3. Include ONLY fields that are explicitly needed to answer the user's request
4. When grouping or filtering is requested, include ONLY the necessary fields for that operation
5. For list queries, include ONLY fields that are explicitly requested or required for display
6. Handle pagination when needed
7. Use fragments for reusable query parts

FIELD SELECTION GUIDELINES:
1. ONLY include fields that are explicitly mentioned in the request
2. ONLY include fields that are required for filtering or grouping operations
3. For list views, ONLY include fields that are explicitly requested
4. ONLY include fields that are directly relevant to the relationships being queried
5. When filtering by a field, ONLY include that field in the selection
6. If the user is asking about an entity's property, ONLY include that specific property field
7. NEVER include fields that are not directly relevant to the request
8. NEVER include fields that are not available on the entity
9. ALWAYS use the exact field names from the schema - do not guess or abbreviate
10. If a field name in the request doesn't match the schema, use the exact name from the schema

FILTER GUIDELINES:
1. When using filters, check the schema for the correct filter input type
2. Look for filter input types in the schema (e.g., "FilterInput", "QueryOperatorInput")
3. Check the schema for the exact structure of filter arguments
4. Verify the filter field names match the schema exactly
5. Ensure filter values match the expected type in the schema
6. When filtering by relationships, check the schema for the correct field name

QUERY STRUCTURE GUIDELINES:
1. Start by examining the schema's Query type to find the root field
2. Check the return type of each field to understand what fields are available
3. For nested objects, check their type definition in the schema
4. For lists, ensure you're using the correct field name and arguments
5. For relationships, verify the field name and any required arguments
6. When using arguments, check their type definition in the schema

ERROR PREVENTION:
1. Before using a field, verify it exists in the schema
2. Check the type of each field to ensure it matches the schema
3. Verify all required arguments are provided
4. Ensure argument values match their expected types
5. For filters, verify the structure matches the schema's input type
6. For relationships, check both the field name and the related type

Current schema:
{schema}

Generate a valid GraphQL query that satisfies this request.`;

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
      ["system", QUERY_BUILDER_PROMPT],
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
