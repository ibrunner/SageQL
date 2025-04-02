import { StateGraph, END, START } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { generateQuery } from "../agents/query-builder.js";
import { createGraphQLExecutorTool } from "../tools/graphql-executor.js";
import { queryValidatorTool } from "../lib/graphql/query-validation-output-parser.js";
import { QueryValidationOutputParser } from "../lib/graphql/query-validation-output-parser.js";
import { VALIDATION_RETRY_PROMPT } from "../agents/prompts/retry-validation.js";
import { EXECUTION_RETRY_PROMPT } from "../agents/prompts/retry-execution.js";
import {
  SCHEMA_ANALYSIS_PROMPT,
  formatErrorContext,
} from "../agents/prompts/schema-analysis.js";
import { formatValidationErrors } from "../lib/graphql/error-formatting.js";
import { logger } from "../lib/logger.js";
import { getMessageString } from "../lib/get-message-string.js";
import { analyzeAndLookupSchema } from "../agents/schema-analyzer.js";
import { llmModel } from "../lib/llm-client.js";
import { schemaListLookup } from "../lib/graphql/schema-lookup/schema-lookup.js";
import { LookupRequest } from "../lib/graphql/schema-lookup/types.js";

const MAX_RETRIES = 3;

const schemaLookupFunction = {
  name: "lookup_schema",
  description: "Look up schema information based on a list of lookup requests",
  parameters: {
    type: "object",
    properties: {
      requests: {
        type: "array",
        items: {
          type: "object",
          properties: {
            lookup: {
              type: "string",
              enum: ["type", "field", "relationships"],
              description: "The type of lookup to perform",
            },
            id: {
              type: "string",
              description: "The type ID for type lookups",
            },
            typeId: {
              type: "string",
              description: "The type ID for field and relationship lookups",
            },
            fieldId: {
              type: "string",
              description: "The field ID for field lookups",
            },
          },
          required: ["lookup"],
          additionalProperties: false,
        },
      },
    },
    required: ["requests"],
  },
};

// Define state schema with reducers
const CompressedQueryGraphStateAnnotation = Annotation.Root({
  messages: Annotation<(string | BaseMessage)[]>({
    reducer: (x, y) => [...(x || []), ...y],
  }),
  schema: Annotation<any>({
    reducer: (x, y) => y || x,
  }),
  compressedSchema: Annotation<any>({
    reducer: (x, y) => y || x,
  }),
  currentQuery: Annotation<string>({
    reducer: (x, y) => y || x,
  }),
  validationErrors: Annotation<string[]>({
    reducer: (x, y) => y,
  }),
  executionResult: Annotation<any>({
    reducer: (x, y) => y || x,
  }),
  schemaAnalysisRetries: Annotation<number>({
    reducer: (x, y) => (y ?? 0) + (x ?? 0),
  }),
  queryGenerationRetries: Annotation<number>({
    reducer: (x, y) => (y ?? 0) + (x ?? 0),
  }),
  validationRetries: Annotation<number>({
    reducer: (x, y) => (y ?? 0) + (x ?? 0),
  }),
  executionRetries: Annotation<number>({
    reducer: (x, y) => (y ?? 0) + (x ?? 0),
  }),
  schemaContext: Annotation<any>({
    reducer: (x, y) => y || x,
  }),
  lookupRequests: Annotation<LookupRequest[]>({
    reducer: (x, y) => y || x,
  }),
  lookupResults: Annotation<{
    success: boolean;
    context: any;
    errors: string[];
  }>({
    reducer: (x, y) => y || x,
  }),
});

export type CompressedQueryGraphState =
  typeof CompressedQueryGraphStateAnnotation.State;

/**
 * Creates a LangGraph for handling GraphQL query generation, validation, and execution
 * using a compressed schema and dynamic schema lookups
 */
export async function createCompressedQueryGraph(
  apiUrl: string,
  compressedSchema?: any,
  fullSchema?: any,
) {
  // Initialize tools
  const executor = createGraphQLExecutorTool(apiUrl);
  const validator = queryValidatorTool;
  const validationParser = new QueryValidationOutputParser();

  // Create the graph
  const workflow = new StateGraph(CompressedQueryGraphStateAnnotation);

  // Schema Analysis Node
  const analyzeSchemaNode = async (state: CompressedQueryGraphState) => {
    logger.info("\n=== Schema Analysis Node ===");
    logger.info("Current State:", {
      retryCount: state.schemaAnalysisRetries || 0,
      hasValidationErrors: state.validationErrors?.length > 0,
      hasSchemaContext: !!state.schemaContext,
      hasCompressedSchema: !!state.compressedSchema,
    });
    const userMessage = getMessageString(
      state.messages[state.messages.length - 1],
    );

    try {
      const chain = SCHEMA_ANALYSIS_PROMPT.pipe(
        llmModel.bind({
          functions: [schemaLookupFunction],
          function_call: { name: "lookup_schema" },
        }),
      );

      logger.info("Analyzing query:", userMessage);
      const response = await chain.invoke({
        userQuery: userMessage,
        errorContext: formatErrorContext(
          state.validationErrors?.[0],
          state.schemaContext
            ? JSON.stringify(state.schemaContext, null, 2)
            : undefined,
        ),
        tools: [
          {
            function: schemaLookupFunction,
            handler: async (args: { requests: LookupRequest[] }) => {
              // Store the requests for later use
              return JSON.stringify({ requests: args.requests });
            },
          },
        ],
      });

      const functionResponse =
        response.additional_kwargs.function_call?.arguments;
      if (!functionResponse) {
        throw new Error("No schema analysis response received");
      }

      const { requests } = JSON.parse(functionResponse);
      logger.info("Schema Analysis Results:", {
        requestCount: requests.length,
        requestTypes: requests.map((r: any) => r.lookup),
        requestDetails: requests,
      });

      logger.info("Schema Analysis Outcome:", {
        success: true,
        proceedingToLookup: true,
        requestsGenerated: requests.length,
        nextStep: "lookup_schema",
      });

      return {
        lookupRequests: requests,
      };
    } catch (error) {
      logger.error("Schema Analysis Failed:", {
        error: error instanceof Error ? error.message : String(error),
        proceedingToRetry: true,
        nextStep: "handle_schema_analysis_error",
      });
      return {
        validationErrors: [
          error instanceof Error ? error.message : "Failed to analyze schema",
        ],
      };
    }
  };

  // Schema Lookup Node
  const lookupSchemaNode = async (state: CompressedQueryGraphState) => {
    logger.info("\n=== Schema Lookup Node ===");
    logger.info("Current State:", {
      retryCount: state.schemaAnalysisRetries || 0,
      hasValidationErrors: state.validationErrors?.length > 0,
      requestCount: state.lookupRequests?.length || 0,
      hasSchemaContext: !!state.schemaContext,
      hasCompressedSchema: !!state.compressedSchema,
    });

    try {
      logger.info(
        "Executing Lookup Requests:",
        JSON.stringify(state.lookupRequests, null, 2),
      );
      const schemaContext = schemaListLookup(fullSchema, state.lookupRequests);

      const summary = schemaContext?.metadata?.summary;
      logger.info(
        "Schema Lookup Results:",
        JSON.stringify(
          {
            success: summary?.successful === state.lookupRequests.length,
            hasPartialResults: summary?.hasPartialResults,
            availableTypes: Object.keys(schemaContext?.types || {}),
            availableFields: Object.keys(schemaContext?.fields || {}),
            availableRelationships: Object.keys(
              schemaContext?.relationships || {},
            ),
            metadata: schemaContext?.metadata,
          },
          null,
          2,
        ),
      );

      // If we have any errors but also some successes, return both
      if (summary?.hasPartialResults) {
        logger.info("Proceeding with Partial Results:", {
          outcome: "partial_success",
          successfulLookups: summary.successful,
          failedLookups: summary.failed,
          errors: schemaContext.metadata.errors.map((e) => e.error),
          action:
            state.schemaAnalysisRetries >= MAX_RETRIES - 1
              ? "proceeding_to_query"
              : "retrying",
          nextStep:
            state.schemaAnalysisRetries >= MAX_RETRIES - 1
              ? "generate_query"
              : "handle_schema_analysis_error",
          availableSchema: {
            types: Object.keys(schemaContext?.types || {}),
            fields: Object.keys(schemaContext?.fields || {}),
          },
        });
        return {
          schemaContext,
          schema: fullSchema,
          compressedSchema: compressedSchema,
          lookupResults: {
            success: false,
            context: schemaContext,
            errors: schemaContext.metadata.errors.map((e) => e.error),
          },
          validationErrors: schemaContext.metadata.errors.map((e) => e.error),
        };
      }

      // If everything succeeded
      if (summary?.successful === state.lookupRequests.length) {
        logger.info("Schema Lookup Complete:", {
          outcome: "full_success",
          successfulLookups: summary.successful,
          availableTypes: Object.keys(schemaContext?.types || {}),
          availableFields: Object.keys(schemaContext?.fields || {}),
          action: "proceeding_to_query",
          nextStep: "generate_query",
        });
        return {
          schemaContext,
          schema: fullSchema,
          compressedSchema: compressedSchema,
          lookupResults: {
            success: true,
            context: schemaContext,
            errors: [],
          },
          validationErrors: [],
        };
      }

      // If everything failed
      logger.error("Schema Lookup Failed:", {
        outcome: "complete_failure",
        failedLookups: summary?.failed,
        errors: schemaContext.metadata.errors.map((e) => e.error),
        action:
          state.schemaAnalysisRetries < MAX_RETRIES ? "retrying" : "ending",
        nextStep:
          state.schemaAnalysisRetries < MAX_RETRIES
            ? "handle_schema_analysis_error"
            : "END",
      });
      return {
        validationErrors: schemaContext.metadata.errors.map((e) => e.error),
        lookupResults: {
          success: false,
          context: {},
          errors: schemaContext.metadata.errors.map((e) => e.error),
        },
      };
    } catch (error) {
      logger.error("Schema Lookup Error:", {
        error: error instanceof Error ? error.message : String(error),
        action:
          state.schemaAnalysisRetries < MAX_RETRIES ? "retrying" : "ending",
        nextStep:
          state.schemaAnalysisRetries < MAX_RETRIES
            ? "handle_schema_analysis_error"
            : "END",
      });
      return {
        validationErrors: [
          error instanceof Error
            ? error.message
            : "Failed to lookup schema information",
        ],
        lookupResults: {
          success: false,
          context: {},
          errors: [error instanceof Error ? error.message : String(error)],
        },
      };
    }
  };

  // Schema Analysis Retry Node
  const handleSchemaAnalysisErrorNode = async (
    state: CompressedQueryGraphState,
  ) => {
    logger.info("\n=== Schema Analysis Error Handler ===");
    logger.info("Retry Status:", {
      currentRetryCount: state.schemaAnalysisRetries || 0,
      maxRetries: MAX_RETRIES,
      remainingRetries: MAX_RETRIES - (state.schemaAnalysisRetries || 0) - 1,
      hasPartialResults:
        state.lookupResults?.context &&
        Object.keys(state.lookupResults.context).length > 0,
      partialResultsSize: state.lookupResults?.context
        ? {
            types: Object.keys(state.lookupResults.context.types || {}).length,
            fields: Object.keys(state.lookupResults.context.fields || {})
              .length,
            relationships: Object.keys(
              state.lookupResults.context.relationships || {},
            ).length,
          }
        : "none",
    });

    // If we've hit max retries, preserve any results we have
    if ((state.schemaAnalysisRetries || 0) + 1 >= MAX_RETRIES) {
      logger.info("Max retries reached, proceeding with partial results");

      // If we have any results at all, try to proceed with them
      if (
        state.lookupResults?.context &&
        Object.keys(state.lookupResults.context).length > 0
      ) {
        logger.info("Proceeding with partial schema context:", {
          availableTypes: Object.keys(state.lookupResults.context.types || {}),
          availableFields: Object.keys(
            state.lookupResults.context.fields || {},
          ),
          availableRelationships: Object.keys(
            state.lookupResults.context.relationships || {},
          ),
        });
        return {
          schemaAnalysisRetries: MAX_RETRIES,
          schemaContext: state.lookupResults.context,
          validationErrors: [], // Clear errors to allow proceeding
        };
      }

      // If we have no results at all, we have to end
      logger.info("No usable results after max retries, ending workflow");
      return {
        schemaAnalysisRetries: MAX_RETRIES,
        validationErrors: [
          "Failed to gather any schema information after maximum retries",
        ],
      };
    }

    logger.info(
      `Continuing with retry attempt ${(state.schemaAnalysisRetries || 0) + 1}/${MAX_RETRIES}`,
    );
    return {
      schemaAnalysisRetries: (state.schemaAnalysisRetries || 0) + 1,
    };
  };

  // Query Generation Node
  const generateQueryNode = async (state: CompressedQueryGraphState) => {
    logger.info("\n=== Query Generation Step ===");
    logger.info("Current State:", {
      hasSchemaContext: !!state.schemaContext,
      hasCompressedSchema: !!state.compressedSchema,
      availableTypes: state.schemaContext
        ? Object.keys(state.schemaContext.types || {})
        : [],
      availableFields: state.schemaContext
        ? Object.keys(state.schemaContext.fields || {})
        : [],
      availableRelationships: state.schemaContext
        ? Object.keys(state.schemaContext.relationships || {})
        : [],
      retryCount: state.queryGenerationRetries || 0,
      hasValidationErrors: state.validationErrors?.length > 0,
    });

    // Ensure we have either schema context or compressed schema when using compressed mode
    if (!state.schemaContext && !state.compressedSchema) {
      logger.error("Query Generation Failed:", {
        reason: "no_schema_context",
        error: "No schema context available for query generation",
        action: "ending",
        nextStep: "END",
      });
      return {
        validationErrors: ["No schema context available for query generation"],
      };
    }

    // Ensure we have a schema for validation
    if (!fullSchema) {
      logger.error("Query Generation Failed:", {
        reason: "no_validation_schema",
        error: "No schema available for validation",
        action: "ending",
        nextStep: "END",
      });
      return {
        validationErrors: ["No schema available for validation"],
      };
    }

    // Use schema context if available, otherwise fall back to compressed schema
    const schemaToUse = state.schemaContext || state.compressedSchema;
    logger.info("Query Generation Input:", {
      schemaType: state.schemaContext ? "dynamic context" : "compressed schema",
      availableTypes: Object.keys(schemaToUse?.types || {}),
      availableFields: Object.keys(schemaToUse?.fields || {}),
      userMessage: getMessageString(state.messages[state.messages.length - 1]),
      schemaSize: JSON.stringify(schemaToUse).length,
      hasValidationSchema: !!fullSchema,
    });

    const result = await generateQuery(
      getMessageString(state.messages[state.messages.length - 1]),
      JSON.stringify(fullSchema),
      schemaToUse,
    );

    logger.info("Query Generation Outcome:", {
      success: !result.errors?.length,
      hasQuery: !!result.query,
      queryLength: result.query?.length,
      errorCount: result.errors?.length || 0,
      query: result.query || null,
      errors: result.errors || [],
      action: result.errors?.length
        ? "proceeding_to_validation"
        : "proceeding_to_execution",
      nextStep: result.errors?.length ? "validate_query" : "execute_query",
    });

    const returnState = {
      currentQuery: result.query,
      validationErrors: result.errors || [],
    };

    logger.info("Query Generation Node Exit:", {
      hasQuery: !!returnState.currentQuery,
      queryLength: returnState.currentQuery?.length,
      hasErrors: returnState.validationErrors.length > 0,
      errors: returnState.validationErrors,
      nextStep:
        returnState.validationErrors.length > 0
          ? "validate_query"
          : "execute_query",
    });

    return returnState;
  };

  // Query Validation Node
  const validateQueryNode = async (state: CompressedQueryGraphState) => {
    logger.info("\n=== Query Validation Step ===");
    logger.info("Validation Input:", {
      query: state.currentQuery,
      hasQuery: !!state.currentQuery,
      queryLength: state.currentQuery?.length,
      hasSchema: !!state.schema,
      retryCount: state.validationRetries || 0,
    });

    const result = await validator.call({
      query: state.currentQuery,
      schema: JSON.stringify(state.schema),
    });
    const validationResult = await validationParser.parse(result);

    logger.info("Validation Node Exit:", {
      isValid: !validationResult.errors?.length,
      hasErrors: (validationResult.errors || []).length > 0,
      errorCount: validationResult.errors?.length || 0,
      errors: validationResult.errors || [],
      retryCount: state.validationRetries || 0,
      canRetry: (state.validationRetries || 0) < MAX_RETRIES,
      nextStep:
        (validationResult.errors || []).length > 0
          ? (state.validationRetries || 0) < MAX_RETRIES
            ? "handle_validation_error"
            : "END"
          : "execute_query",
    });

    return {
      validationErrors: validationResult.errors || [],
    };
  };

  // Query Execution Node
  const executeQueryNode = async (state: CompressedQueryGraphState) => {
    logger.info("\n=== Query Execution Step ===");
    logger.info("Execution Input:", {
      query: state.currentQuery,
      hasQuery: !!state.currentQuery,
      queryLength: state.currentQuery?.length,
      retryCount: state.executionRetries || 0,
    });

    try {
      const result = await executor.call({
        query: state.currentQuery,
      });
      const parsedResult = JSON.parse(result);

      logger.info("Query Execution Success:", {
        hasResult: !!parsedResult,
        resultSize: JSON.stringify(parsedResult).length,
        hasData: !!parsedResult.data,
        hasErrors: !!parsedResult.errors,
        errors: parsedResult.errors || [],
        action: "ending",
        nextStep: "END",
      });

      return {
        executionResult: parsedResult,
        validationErrors: parsedResult.errors
          ? [
              parsedResult.errors
                .map((e: { message: string }) => e.message)
                .join(", "),
            ]
          : [],
      };
    } catch (error) {
      logger.error("Query Execution Failed:", {
        error: error instanceof Error ? error.message : String(error),
        retryCount: state.executionRetries || 0,
        canRetry: (state.executionRetries || 0) < MAX_RETRIES,
        action:
          (state.executionRetries || 0) < MAX_RETRIES ? "retrying" : "ending",
        nextStep:
          (state.executionRetries || 0) < MAX_RETRIES
            ? "handle_execution_error"
            : "END",
      });

      return {
        validationErrors: [
          error instanceof Error ? error.message : String(error),
        ],
      };
    }
  };

  // Validation Retry Node
  const handleValidationErrorNode = async (
    state: CompressedQueryGraphState,
  ) => {
    logger.info("\n=== Validation Error Handler ===");
    logger.info("Current Query State:", {
      query: state.currentQuery,
      hasQuery: !!state.currentQuery,
      queryLength: state.currentQuery?.length,
    });
    logger.info("Validation Errors:", state.validationErrors);

    const { validationContext } = formatValidationErrors(
      state.validationErrors,
    );
    logger.info("Formatted Validation Context:", validationContext);

    const formattedPrompt = await VALIDATION_RETRY_PROMPT.format({
      validationContext,
      failedQuery: state.currentQuery,
      schemaContext: JSON.stringify(state.schemaContext, null, 2),
    });
    logger.info("Formatted Retry Prompt:", formattedPrompt);

    return {
      messages: [...state.messages, getMessageString(formattedPrompt.content)],
      validationRetries: (state.validationRetries || 0) + 1,
    };
  };

  // Execution Retry Node
  const handleExecutionErrorNode = async (state: CompressedQueryGraphState) => {
    const formattedPrompt = await EXECUTION_RETRY_PROMPT.format({
      errorMessage: state.validationErrors[0],
      failedQuery: state.currentQuery,
      schemaContext: JSON.stringify(state.schemaContext, null, 2),
    });

    return {
      messages: [...state.messages, getMessageString(formattedPrompt.content)],
      executionRetries: (state.executionRetries || 0) + 1,
    };
  };

  // Build the graph with chained method calls
  const graph = workflow
    .addNode("analyze_schema", analyzeSchemaNode)
    .addNode("lookup_schema", lookupSchemaNode)
    .addNode("generate_query", generateQueryNode)
    .addNode("validate_query", validateQueryNode)
    .addNode("execute_query", executeQueryNode)
    .addNode("handle_validation_error", handleValidationErrorNode)
    .addNode("handle_execution_error", handleExecutionErrorNode)
    .addNode("handle_schema_analysis_error", handleSchemaAnalysisErrorNode)
    .addEdge(START, "analyze_schema")
    .addConditionalEdges(
      "analyze_schema",
      (state: CompressedQueryGraphState) => {
        const hasErrors = state.validationErrors?.length > 0;
        const canRetry = (state.schemaAnalysisRetries || 0) < MAX_RETRIES;
        const hasPartialResults =
          state.lookupResults?.context &&
          Object.keys(state.lookupResults.context).length > 0;

        let nextStep;
        if (hasErrors) {
          if (canRetry) {
            nextStep = "handle_schema_analysis_error";
          } else if (hasPartialResults) {
            // At max retries but have partial results - proceed to lookup
            nextStep = "lookup_schema";
          } else {
            // At max retries with no results - end
            nextStep = END;
          }
        } else {
          nextStep = "lookup_schema";
        }

        logger.info("Schema Analysis State Transition:", {
          from: "analyze_schema",
          to: nextStep,
          hasErrors,
          retryCount: state.schemaAnalysisRetries || 0,
          canRetry,
          hasPartialResults,
          atMaxRetries: !canRetry,
          validationErrors: state.validationErrors,
          availableContext: state.lookupResults?.context
            ? {
                types: Object.keys(state.lookupResults.context.types || {}),
                fields: Object.keys(state.lookupResults.context.fields || {}),
              }
            : null,
        });

        return nextStep;
      },
      ["handle_schema_analysis_error", "lookup_schema", END],
    )
    .addEdge("handle_schema_analysis_error", "analyze_schema")
    .addEdge("generate_query", "validate_query")
    .addConditionalEdges(
      "validate_query",
      (state: CompressedQueryGraphState) => {
        const hasErrors = state.validationErrors.length > 0;
        const canRetry = (state.validationRetries || 0) < MAX_RETRIES;
        const nextStep = hasErrors
          ? canRetry
            ? "handle_validation_error"
            : END
          : "execute_query";

        logger.info("Query Validation State Transition:", {
          from: "validate_query",
          to: nextStep,
          hasErrors,
          retryCount: state.validationRetries || 0,
          canRetry,
          validationErrors: state.validationErrors,
        });

        return nextStep;
      },
      ["handle_validation_error", "execute_query", END],
    )
    .addConditionalEdges(
      "execute_query",
      (state: CompressedQueryGraphState) => {
        const hasErrors = state.validationErrors.length > 0;
        const canRetry = (state.executionRetries || 0) < MAX_RETRIES;
        const nextStep = hasErrors
          ? canRetry
            ? "handle_execution_error"
            : END
          : END;

        logger.info("Query Execution State Transition:", {
          from: "execute_query",
          to: nextStep,
          hasErrors,
          retryCount: state.executionRetries || 0,
          canRetry,
          validationErrors: state.validationErrors,
          hasExecutionResult: !!state.executionResult,
        });

        return nextStep;
      },
      ["handle_execution_error", END],
    )
    .addEdge("handle_validation_error", "analyze_schema")
    .addEdge("handle_execution_error", "analyze_schema")
    .addConditionalEdges(
      "lookup_schema",
      (state: CompressedQueryGraphState) => {
        const hasErrors = state.validationErrors?.length > 0;
        const hasPartialResults =
          state.lookupResults?.context &&
          Object.keys(state.lookupResults.context).length > 0;
        const atMaxRetries =
          (state.schemaAnalysisRetries || 0) >= MAX_RETRIES - 1;
        let nextStep;

        if (hasErrors) {
          if (hasPartialResults && atMaxRetries) {
            nextStep = "generate_query";
          } else {
            nextStep =
              state.schemaAnalysisRetries < MAX_RETRIES
                ? "handle_schema_analysis_error"
                : "generate_query";
          }
        } else {
          nextStep = "generate_query";
        }

        logger.info("Schema Lookup State Transition:", {
          from: "lookup_schema",
          to: nextStep,
          hasErrors,
          hasPartialResults,
          retryCount: state.schemaAnalysisRetries || 0,
          atMaxRetries,
          validationErrors: state.validationErrors,
          availableContext: state.lookupResults?.context
            ? {
                types: Object.keys(state.lookupResults.context.types || {}),
                fields: Object.keys(state.lookupResults.context.fields || {}),
              }
            : null,
        });

        return nextStep;
      },
      ["handle_schema_analysis_error", "generate_query", END],
    );

  return graph.compile();
}
