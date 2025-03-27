import { StateGraph, END, START } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { generateQuery } from "../agents/queryBuilder.js";
import { createGraphQLExecutorTool } from "../tools/graphqlExecutor.js";
import { queryValidatorTool } from "../tools/queryValidator.js";
import { QueryValidationOutputParser } from "../tools/queryValidator.js";
import { VALIDATION_RETRY_PROMPT } from "../agents/prompts/retryValidation.js";
import { EXECUTION_RETRY_PROMPT } from "../agents/prompts/retryExecution.js";
import { formatValidationErrors } from "../lib/graphql/errorFormatting.js";
import { logger } from "../lib/logger.js";
import { getMessageString } from "../lib/getMessageString.js";

// Define state schema with reducers
const QueryGraphStateAnnotation = Annotation.Root({
  messages: Annotation<(string | BaseMessage)[]>({
    reducer: (x, y) => [...(x || []), ...y],
  }),
  schema: Annotation<string>({
    reducer: (x, y) => y || x,
  }),
  currentQuery: Annotation<string>({
    reducer: (x, y) => y || x,
  }),
  validationErrors: Annotation<string[]>({
    reducer: (x, y) => y || x,
  }),
  executionResult: Annotation<any>({
    reducer: (x, y) => y || x,
  }),
  retryCount: Annotation<number>({
    reducer: (x, y) => (y ?? 0) + (x ?? 0),
  }),
});

export type QueryGraphState = typeof QueryGraphStateAnnotation.State;

const MAX_RETRIES = 3;

/**
 * Creates a LangGraph for handling GraphQL query generation, validation, and execution
 */
export async function createQueryGraph(apiUrl: string) {
  // Initialize tools
  const executor = createGraphQLExecutorTool(apiUrl);
  const validator = queryValidatorTool;
  const validationParser = new QueryValidationOutputParser();

  // Create the graph
  const workflow = new StateGraph(QueryGraphStateAnnotation);

  // Query Generation Node
  const generateQueryNode = async (state: QueryGraphState) => {
    logger.debug("\n=== Query Generation Step ===");
    const result = await generateQuery(
      getMessageString(state.messages[state.messages.length - 1]),
      state.schema,
      {},
    );
    return {
      currentQuery: result.query,
      validationErrors: result.errors || [],
    };
  };

  // Query Validation Node
  const validateQueryNode = async (state: QueryGraphState) => {
    logger.debug("\n=== Query Validation Step ===");
    const result = await validator.call({
      query: state.currentQuery,
      schema: state.schema,
    });
    const validationResult = await validationParser.parse(result);

    return {
      validationErrors: validationResult.errors || [],
    };
  };

  // Query Execution Node
  const executeQueryNode = async (state: QueryGraphState) => {
    logger.debug("\n=== Query Execution Step ===");
    try {
      const result = await executor.call({
        query: state.currentQuery,
      });
      return {
        executionResult: JSON.parse(result),
      };
    } catch (error) {
      return {
        validationErrors: [
          error instanceof Error ? error.message : String(error),
        ],
      };
    }
  };

  // Validation Retry Node
  const handleValidationErrorNode = async (state: QueryGraphState) => {
    const { validationContext } = formatValidationErrors(
      state.validationErrors,
    );
    const formattedPrompt = await VALIDATION_RETRY_PROMPT.format({
      validationContext,
      failedQuery: state.currentQuery,
      schemaContext: JSON.stringify(state.schema, null, 2),
    });

    return {
      messages: [...state.messages, getMessageString(formattedPrompt.content)],
      retryCount: 1,
    };
  };

  // Execution Retry Node
  const handleExecutionErrorNode = async (state: QueryGraphState) => {
    const formattedPrompt = await EXECUTION_RETRY_PROMPT.format({
      errorMessage: state.validationErrors[0],
      failedQuery: state.currentQuery,
      schemaContext: JSON.stringify(state.schema, null, 2),
    });

    return {
      messages: [...state.messages, getMessageString(formattedPrompt.content)],
      retryCount: 1,
    };
  };

  // Build the graph with chained method calls
  const graph = workflow
    .addNode("generate_query", generateQueryNode)
    .addNode("validate_query", validateQueryNode)
    .addNode("execute_query", executeQueryNode)
    .addNode("handle_validation_error", handleValidationErrorNode)
    .addNode("handle_execution_error", handleExecutionErrorNode)
    .addEdge(START, "generate_query")
    .addEdge("generate_query", "validate_query")
    .addConditionalEdges(
      "validate_query",
      (state: QueryGraphState) => {
        if (state.validationErrors.length > 0) {
          return state.retryCount < MAX_RETRIES
            ? "handle_validation_error"
            : END;
        }
        return "execute_query";
      },
      ["handle_validation_error", "execute_query", END],
    )
    .addConditionalEdges(
      "execute_query",
      (state: QueryGraphState) => {
        if (state.validationErrors.length > 0) {
          return state.retryCount < MAX_RETRIES
            ? "handle_execution_error"
            : END;
        }
        return END;
      },
      ["handle_execution_error", END],
    )
    .addEdge("handle_validation_error", "generate_query")
    .addEdge("handle_execution_error", "generate_query");

  return graph.compile();
}
