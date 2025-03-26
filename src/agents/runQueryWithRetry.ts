import { ChainState } from "../workflows/chain.js";
import { formatValidationErrors } from "../lib/errorFormatting.js";
import { VALIDATION_RETRY_PROMPT } from "./prompts/retryValidation.js";
import { EXECUTION_RETRY_PROMPT } from "./prompts/retryExecution.js";
import { BaseMessage, MessageContent } from "@langchain/core/messages";

/**
 * Executes a GraphQL query with automatic retry logic for validation errors
 * @param {any} graph - The LangGraph instance for query execution
 * @param {ChainState} initialState - Initial state containing query and schema information
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {boolean} verbose - Flag for detailed logging output (default: false)
 * @returns {Promise<ChainState>} Final state after query execution
 * @throws {Error} When max retries are reached without successful validation
 */
export async function runQueryWithRetry(
  graph: any,
  initialState: ChainState,
  maxRetries: number = 3,
  verbose: boolean = false,
): Promise<ChainState> {
  let currentState = initialState;
  let attempt = 1;

  while (attempt <= maxRetries) {
    if (verbose) {
      console.log(`\n=== Attempt ${attempt}/${maxRetries} ===`);
      if (attempt > 1) {
        console.log("Previous query:", currentState.currentQuery);
        console.log("Previous errors:", currentState.validationErrors);
        console.log("Current messages:", currentState.messages);
      }
    }

    try {
      const result = await graph.invoke(currentState);

      if (result.validationErrors?.length > 0) {
        console.log("\nValidation Errors:");
        result.validationErrors.forEach((error: string) =>
          console.log(`- ${error}`),
        );

        if (attempt < maxRetries) {
          console.log("\nRetrying with updated context...");
          currentState = await handleValidationError(
            currentState,
            result.validationErrors,
            verbose,
          );
          attempt++;
          continue;
        }
      }

      return result;
    } catch (error) {
      console.log("\nExecution Error:");
      console.log(`- ${error instanceof Error ? error.message : error}`);

      if (attempt < maxRetries) {
        console.log("\nRetrying with updated context...");
        currentState = await handleExecutionError(currentState, error, verbose);
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
  verbose: boolean = false,
): Promise<ChainState> {
  const { validationContext } = formatValidationErrors(validationErrors);

  const formattedPrompt = await VALIDATION_RETRY_PROMPT.format({
    validationContext,
    failedQuery: currentState.currentQuery,
    schemaContext: JSON.stringify(currentState.schema, null, 2),
  });

  if (verbose) {
    console.log("\nRetry context being sent to model:");
    console.log(formattedPrompt);
  }

  const firstMessage = currentState.messages[0];
  const originalQuery =
    typeof firstMessage === "string"
      ? firstMessage
      : getMessageString((firstMessage as BaseMessage).content);

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
  verbose: boolean = false,
): Promise<ChainState> {
  const errorMessage = error instanceof Error ? error.message : String(error);

  const formattedPrompt = await EXECUTION_RETRY_PROMPT.format({
    errorMessage,
    failedQuery: currentState.currentQuery,
    schemaContext: JSON.stringify(currentState.schema, null, 2),
  });

  if (verbose) {
    console.log("\nRetry context being sent to model:");
    console.log(formattedPrompt);
  }

  const firstMessage = currentState.messages[0];
  const originalQuery =
    typeof firstMessage === "string"
      ? firstMessage
      : getMessageString((firstMessage as BaseMessage).content);

  return {
    ...currentState,
    messages: [originalQuery, getMessageString(formattedPrompt.content)],
    validationErrors: [],
  };
}

function getMessageString(content: MessageContent): string {
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
