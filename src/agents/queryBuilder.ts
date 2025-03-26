import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { GraphQLSchema, parse, validate, buildClientSchema } from "graphql";
import { llmModel } from "../lib/llmClient.js";
import { QUERY_BUILDER_PROMPT_TEMPLATE } from "./prompts/queryBuilder.js";

export interface QueryBuilderState {
  messages: BaseMessage[];
  schema: string;
  currentQuery?: string;
  validationErrors?: string[];
}

export interface QueryBuilderConfig {
  model?: ChatOpenAI;
  verbose?: boolean;
}

export interface QueryResult {
  query: string;
  errors?: string[];
}

const extractGraphQLQuery = (response: string): string => {
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
};

const validateGraphQLQuery = (
  query: string,
  schema: GraphQLSchema,
): { isValid: boolean; errors?: string[] } => {
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
};

export const createQueryBuilderPrompt = () => {
  return ChatPromptTemplate.fromMessages([
    ["system", QUERY_BUILDER_PROMPT_TEMPLATE],
    new MessagesPlaceholder("messages"),
  ]);
};

const logDebug = (verbose: boolean, message: string, data?: any) => {
  if (verbose) {
    console.log(message);
    if (data !== undefined) {
      console.log(data);
    }
  }
};

export const generateQuery = async (
  request: string,
  schema: string,
  config: QueryBuilderConfig = {},
): Promise<QueryResult> => {
  const { model = llmModel, verbose = false } = config;
  const prompt = createQueryBuilderPrompt();

  logDebug(verbose, "\n=== Generating Query ===");
  logDebug(verbose, "Request:", request);
  logDebug(verbose, "Schema:", schema);

  // Format the prompt
  logDebug(verbose, "\n=== Invoking Model ===");
  const formattedPrompt = await prompt.format({
    schema,
    messages: [new HumanMessage(request)],
  });
  logDebug(verbose, "Formatted prompt:", formattedPrompt);

  // Get response from model
  const response = await model.invoke(formattedPrompt);
  logDebug(verbose, "Model execution completed");
  logDebug(verbose, "Raw response:", response);

  // Extract the query from the response
  const extractedQuery = extractGraphQLQuery(
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content),
  );
  logDebug(verbose, "Extracted query:", extractedQuery);

  // Parse the schema for validation
  const parsedSchema = buildClientSchema(JSON.parse(schema));

  // Validate the extracted query
  const validation = validateGraphQLQuery(extractedQuery, parsedSchema);
  logDebug(verbose, "Validation result:", validation);

  return {
    query: extractedQuery,
    errors: validation.errors,
  };
};
