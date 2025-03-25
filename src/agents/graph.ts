import { RunnableSequence } from "@langchain/core/runnables";
import { QueryBuilderAgent } from "./query-builder.js";
import { GraphQLExecutorTool } from "../tools/graphql-executor.js";
import { QueryValidatorTool } from "../tools/query-validator.js";

export interface GraphState {
  messages: string[];
  schema: string;
  currentQuery: string;
  validationErrors: string[];
  executionResult: any;
}

export async function createQueryGraph(
  apiUrl: string,
  verbose: boolean = false,
): Promise<RunnableSequence> {
  // Create tools
  const queryBuilder = new QueryBuilderAgent(
    process.env.OPENAI_MODEL || "gpt-4-turbo-preview",
    verbose,
  );
  const validator = new QueryValidatorTool();
  const executor = new GraphQLExecutorTool(apiUrl);

  // Create the graph
  const graph = RunnableSequence.from([
    // Query builder step
    async (state: GraphState) => {
      if (verbose) console.log("\n=== Query Builder Step ===");
      const result = await queryBuilder.generateQuery(
        state.messages[state.messages.length - 1],
        state.schema,
      );
      return {
        ...state,
        currentQuery: result.query,
        validationErrors: result.errors,
      };
    },
    // Validator step
    async (state: GraphState) => {
      if (verbose) console.log("\n=== Query Validator Step ===");
      const result = await validator.call({
        query: state.currentQuery,
        schema: state.schema,
      });
      const validationResult = JSON.parse(result);
      if (verbose) {
        console.log("Validation result:", validationResult);
      }
      return {
        ...state,
        validationErrors: validationResult.errors,
      };
    },
    // Executor step
    async (state: GraphState) => {
      if (verbose) console.log("\n=== Query Executor Step ===");
      if (state.validationErrors?.length > 0) {
        return state;
      }
      const result = await executor.call({
        query: state.currentQuery,
      });
      if (verbose) {
        console.log("Execution result:", result);
      }
      return {
        ...state,
        executionResult: result,
      };
    },
  ]);

  return graph;
}
