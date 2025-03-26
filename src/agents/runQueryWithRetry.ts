import { ChainState } from "../workflows/chain.js";
import { formatValidationErrors } from "../lib/errorFormatting.js";
import { VALIDATION_RETRY_PROMPT } from "./prompts/retryValidation.js";
import { EXECUTION_RETRY_PROMPT } from "./prompts/retryExecution.js";
import { BaseMessage, MessageContent } from "@langchain/core/messages";
import { logger } from "../lib/logger.js";
/**
 * Executes a GraphQL query with automatic retry logic for validation errors
 * @param {any} graph - The LangGraph instance for query execution
 * @param {ChainState} initialState - Initial state containing query and schema information
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @returns {Promise<ChainState>} Final state after query execution
 * @throws {Error} When max retries are reached without successful validation
 */
export async function runQueryWithRetry(
  graph: any,
  initialState: ChainState,
  maxRetries: number = 3,
): Promise<ChainState> {
  let currentState = initialState;
  let attempt = 1;

  while (attempt <= maxRetries) {
    logger.debug(`\n=== Attempt ${attempt}/${maxRetries} ===`);
    if (attempt > 1) {
      logger.debug("Previous query:", currentState.currentQuery);
      logger.debug("Previous errors:", currentState.validationErrors);
      logger.debug("Current messages:", currentState.messages);
    }

    try {
      const result = await graph.invoke(currentState);

      if (result.validationErrors?.length > 0) {
        logger.info("\nValidation Errors:");
        result.validationErrors.forEach((error: string) =>
          logger.info(`- ${error}`),
        );

        if (attempt < maxRetries) {
          logger.info("\nRetrying with updated context...");
          currentState = await handleValidationError(
            currentState,
            result.validationErrors,
          );
          attempt++;
          continue;
        }
      }

      return result;
    } catch (error) {
      logger.error("\nExecution Error:");
      logger.error(`- ${error instanceof Error ? error.message : error}`);

      if (attempt < maxRetries) {
        logger.info("\nRetrying with updated context...");
        currentState = await handleExecutionError(currentState, error);
        attempt++;
        continue;
      }
      throw error;
    }
  }

  throw new Error("Max retries reached without successful validation");
}

/**
 * Handles validation errors and prepares state for retry
 */
async function handleValidationError(
  currentState: ChainState,
  validationErrors: string[],
): Promise<ChainState> {
  const { validationContext } = formatValidationErrors(validationErrors);

  const formattedPrompt = await VALIDATION_RETRY_PROMPT.format({
    validationContext,
    failedQuery: currentState.currentQuery,
    schemaContext: JSON.stringify(currentState.schema, null, 2),
  });

  logger.debug("\nRetry context being sent to model:");
  logger.debug(getMessageString(formattedPrompt));

  const firstMessage = currentState.messages[0];
  const originalQuery = getMessageString(firstMessage);

  return {
    ...currentState,
    messages: [originalQuery, getMessageString(formattedPrompt.content)],
    validationErrors: [],
  };
}

/**
 * Handles execution errors and prepares state for retry
 */
async function handleExecutionError(
  currentState: ChainState,
  error: unknown,
): Promise<ChainState> {
  const errorMessage = error instanceof Error ? error.message : String(error);

  const formattedPrompt = await EXECUTION_RETRY_PROMPT.format({
    errorMessage,
    failedQuery: currentState.currentQuery,
    schemaContext: JSON.stringify(currentState.schema, null, 2),
  });

  logger.debug("\nRetry context being sent to model:");
  logger.debug(getMessageString(formattedPrompt));

  const firstMessage = currentState.messages[0];
  const originalQuery = getMessageString(firstMessage);

  return {
    ...currentState,
    messages: [originalQuery, getMessageString(formattedPrompt.content)],
    validationErrors: [],
  };
}

/**
 * Converts MessageContent or BaseMessage to string representation
 */
export function getMessageString(
  content: MessageContent | BaseMessage,
): string {
  if (content instanceof BaseMessage) {
    return getMessageString(content.content);
  }
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .join(" ");
  }
  return JSON.stringify(content);
}
