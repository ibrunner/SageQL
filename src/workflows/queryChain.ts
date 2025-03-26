import { RunnableSequence } from "@langchain/core/runnables";
import { generateQuery } from "../agents/queryBuilder.js";
import { createGraphQLExecutorTool } from "../tools/graphqlExecutor.js";
import { queryValidatorTool } from "../tools/queryValidator.js";
import { logger } from "../lib/logger.js";
import { BaseMessage } from "@langchain/core/messages";
import { getMessageString } from "../lib/getMessageString.js";

export interface QueryChainState {
  messages: (string | BaseMessage)[];
  schema: string;
  currentQuery: string;
  validationErrors: string[];
  executionResult: any;
}

export async function createQueryChain(
  apiUrl: string,
): Promise<RunnableSequence> {
  // Create tools
  const executor = createGraphQLExecutorTool(apiUrl);
  const validator = queryValidatorTool;

  // Create the chain
  const chain = RunnableSequence.from([
    // Query builder step
    async (state: QueryChainState) => {
      logger.debug("\n=== Query Builder Step ===");
      const result = await generateQuery(
        getMessageString(state.messages[state.messages.length - 1]),
        state.schema,
        {},
      );
      return {
        ...state,
        currentQuery: result.query,
        validationErrors: result.errors || [],
      };
    },
    // Validator step
    async (state: QueryChainState) => {
      logger.debug("\n=== Query Validator Step ===");
      const result = await validator.call({
        query: state.currentQuery,
        schema: state.schema,
      });
      const validationResult = JSON.parse(result);
      logger.debug("Validation result:", validationResult);
      return {
        ...state,
        validationErrors: validationResult.errors,
      };
    },
    // Executor step
    async (state: QueryChainState) => {
      logger.debug("\n=== Query Executor Step ===");
      if (state.validationErrors?.length > 0) {
        return state;
      }
      const result = await executor.call({
        query: state.currentQuery,
      });
      logger.debug("Execution result:", result);
      return {
        ...state,
        executionResult: result,
      };
    },
  ]);

  return chain;
}
