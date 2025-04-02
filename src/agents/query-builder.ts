import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { GraphQLSchema, parse, validate, buildClientSchema } from "graphql";
import { llmModel } from "../lib/llm-client.js";
import { QUERY_BUILDER_PROMPT_TEMPLATE } from "./prompts/query-builder.js";
import { logger } from "../lib/logger.js";

export interface QueryBuilderState {
  messages: BaseMessage[];
  schema: string;
  currentQuery?: string;
  validationErrors?: string[];
}

export interface QueryBuilderConfig {
  model?: ChatOpenAI;
  schemaContext?: any;
}

export interface QueryResult {
  query: string;
  errors?: string[];
}

export interface QueryGenerationResult {
  query?: string;
  validationErrors?: string[];
  errors?: string[];
}

const createQueryBuilderPrompt = () => {
  return ChatPromptTemplate.fromMessages([
    ["system", QUERY_BUILDER_PROMPT_TEMPLATE],
    new MessagesPlaceholder("messages"),
  ]);
};

const extractGraphQLQuery = (response: string): string => {
  logger.debug("Raw response to extract query from:", response);

  // Extract query from between backticks or curly braces
  const queryMatch =
    response.match(/\`([\s\S]*?)\`/) || response.match(/\{([\s\S]*?)\}/);
  const extractedQuery = queryMatch ? queryMatch[1].trim() : response.trim();
  logger.debug("Extracted query (before any processing):", extractedQuery);

  // Count opening and closing braces to check if they're balanced
  const openBraces = (extractedQuery.match(/\{/g) || []).length;
  const closeBraces = (extractedQuery.match(/\}/g) || []).length;
  logger.debug("Brace count:", { openBraces, closeBraces });

  // If braces aren't balanced, add missing closing braces
  let processedQuery = extractedQuery;
  if (openBraces > closeBraces) {
    const missingBraces = openBraces - closeBraces;
    processedQuery = extractedQuery + "\n" + "}".repeat(missingBraces);
    logger.debug("Added missing closing braces:", missingBraces);
  }

  // Ensure the query starts with 'query' or '{'
  if (!processedQuery.startsWith("query") && !processedQuery.startsWith("{")) {
    processedQuery = `query {\n${processedQuery}\n}`;
    logger.debug("Query wrapped with query keyword");
  }

  logger.debug("Final processed query:", processedQuery);
  return processedQuery;
};

const validateGraphQLQuery = (
  query: string,
  schema: any,
): { isValid: boolean; errors?: string[] } => {
  try {
    logger.debug("Attempting to validate query:", query);
    const ast = parse(query);
    logger.debug("Query parsed successfully to AST");

    // Build the schema from the introspection result
    const parsedSchema = buildClientSchema(JSON.parse(schema));
    logger.debug("Schema built successfully");

    const validationErrors = validate(parsedSchema, ast);
    logger.debug("Validation complete, errors:", validationErrors);

    if (validationErrors.length > 0) {
      return {
        isValid: false,
        errors: validationErrors.map((error) => error.message),
      };
    }

    return { isValid: true };
  } catch (error) {
    logger.error("Query Validation Error:", {
      error,
      query,
      schemaAvailable: !!schema,
    });
    return {
      isValid: false,
      errors: [
        error instanceof Error ? error.message : "Unknown validation error",
      ],
    };
  }
};

export const generateQuery = async (
  request: string,
  schema: any,
  schemaContext?: any,
): Promise<QueryGenerationResult> => {
  logger.debug("\n=== Query Generation Step ===");
  logger.debug("Request:", request);
  logger.debug(
    "Schema Context:",
    JSON.stringify(
      {
        types: schemaContext ? Object.keys(schemaContext.types || {}) : [],
        fields: schemaContext ? Object.keys(schemaContext.fields || {}) : [],
        metadata: schemaContext?.metadata || {},
      },
      null,
      2,
    ),
  );

  try {
    const prompt = createQueryBuilderPrompt();
    const formattedPrompt = await prompt.format({
      schema: schemaContext ? JSON.stringify(schemaContext, null, 2) : schema,
      messages: [new HumanMessage(request)],
    });
    logger.debug("Formatted Prompt:", formattedPrompt);

    const response = await llmModel.invoke(formattedPrompt);
    logger.debug("Model Response:", response);

    const query = extractGraphQLQuery(
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content),
    );
    if (!query) {
      logger.error("No GraphQL query found in response");
      return {
        validationErrors: ["No GraphQL query found in response"],
      };
    }
    logger.debug("Extracted Query:", query);

    const validationResult = validateGraphQLQuery(query, schema);
    if (!validationResult.isValid) {
      logger.error("Query Validation Failed:", {
        errors: validationResult.errors,
        query,
      });
      return {
        query,
        validationErrors: validationResult.errors,
      };
    }

    logger.debug("Query Validation Passed");
    return { query };
  } catch (error) {
    logger.error("Query Generation Error:", error);
    return {
      validationErrors: [
        error instanceof Error ? error.message : "Failed to generate query",
      ],
    };
  }
};
