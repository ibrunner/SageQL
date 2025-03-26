import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { GraphQLSchema, parse, validate, buildClientSchema } from "graphql";
import { llmModel } from "../lib/llmClient.js";
import { QUERY_BUILDER_PROMPT_TEMPLATE } from "./prompts/queryBuilder.js";
import { logger } from "../lib/logger.js";

export interface QueryBuilderState {
  messages: BaseMessage[];
  schema: string;
  currentQuery?: string;
  validationErrors?: string[];
}

export interface QueryBuilderConfig {
  model?: ChatOpenAI;
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

export const generateQuery = async (
  request: string,
  schema: string,
  config: QueryBuilderConfig = {},
): Promise<QueryResult> => {
  const { model = llmModel } = config;
  const prompt = createQueryBuilderPrompt();

  logger.debug("\n=== Generating Query ===");
  logger.debug("Request:", request);
  logger.debug("Schema:", schema);

  // Format the prompt
  logger.debug("\n=== Invoking Model ===");
  const formattedPrompt = await prompt.format({
    schema,
    messages: [new HumanMessage(request)],
  });
  logger.debug("Formatted prompt:", formattedPrompt);

  // Get response from model
  const response = await model.invoke(formattedPrompt);
  logger.debug("Model execution completed");
  logger.debug("Raw response:", response);

  // Extract the query from the response
  const extractedQuery = extractGraphQLQuery(
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content),
  );
  logger.debug("Extracted query:", extractedQuery);

  // Parse the schema for validation
  const parsedSchema = buildClientSchema(JSON.parse(schema));

  // Validate the extracted query
  const validation = validateGraphQLQuery(extractedQuery, parsedSchema);
  logger.debug("Validation result:", validation);

  return {
    query: extractedQuery,
    errors: validation.errors,
  };
};
