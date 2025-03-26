import { ChainState } from "./chain.js";
import { formatValidationErrors } from "../lib/graphql/errorFormatting.js";
import { VALIDATION_RETRY_PROMPT } from "../agents/prompts/retryValidation.js";
import { EXECUTION_RETRY_PROMPT } from "../agents/prompts/retryExecution.js";
import { logger } from "../lib/logger.js";
import { getMessageString } from "../lib/getMessageString.js";

/**
 * Executes a the langchain chain with automatic retry logic for validation errors
 * @param {any} chain - The LangGraph instance for query execution
 * @param {ChainState} initialState - Initial state containing query and schema information
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @returns {Promise<ChainState>} Final state after query execution
 * @throws {Error} When max retries are reached without successful validation
 */
export async function runQueryChainWithRetry(
  chain: any,
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
      const result = await chain.invoke(currentState);

      if (result.validationErrors?.length) {
        logger.error("\nValidation Errors:");
        result.validationErrors.forEach((error: string) =>
          logger.error(`- ${error}`),
        );

        if (attempt < maxRetries) {
          logger.info("\nRetrying with updated context...");

          // Add structured validation error handling
          const { validationContext } = formatValidationErrors(
            result.validationErrors,
          );
          const formattedPrompt = await VALIDATION_RETRY_PROMPT.format({
            validationContext,
            failedQuery: result.currentQuery,
            schemaContext: JSON.stringify(currentState.schema, null, 2),
          });

          logger.debug("\nRetry context being sent to model:");
          logger.debug(getMessageString(formattedPrompt));

          currentState = {
            ...currentState,
            messages: [
              ...currentState.messages,
              getMessageString(formattedPrompt.content),
            ],
            validationErrors: [],
          };
          attempt++;
          continue;
        }
      }

      return result;
    } catch (error) {
      logger.error("\nExecution Error:");
      if (error instanceof Error) {
        logger.error(`- ${error.message}`);
      } else {
        logger.error(`- ${error}`);
      }

      if (attempt < maxRetries) {
        logger.info("\nRetrying with updated context...");

        // Add structured execution error handling
        const formattedPrompt = await EXECUTION_RETRY_PROMPT.format({
          errorMessage: error instanceof Error ? error.message : String(error),
          failedQuery: currentState.currentQuery,
          schemaContext: JSON.stringify(currentState.schema, null, 2),
        });

        logger.debug("\nRetry context being sent to model:");
        logger.debug(getMessageString(formattedPrompt));

        currentState = {
          ...currentState,
          messages: [
            ...currentState.messages,
            getMessageString(formattedPrompt.content),
          ],
          validationErrors: [],
        };
        attempt++;
        continue;
      }
      throw error;
    }
  }

  throw new Error("Max retries reached without successful validation");
}

/**
 * Executes a GraphQL query with automatic retry logic for validation errors
 * @param {any} graph - The LangGraph instance for query execution
 * @param {ChainState} initialState - Initial state containing query and schema information
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @returns {Promise<ChainState>} Final state after query execution
 * @throws {Error} When max retries are reached without successful validation
 */
export async function runQueryChainWithRetryOld(
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
