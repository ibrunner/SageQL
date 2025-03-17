import { RunnableSequence } from "@langchain/core/runnables";
import { QueryBuilderAgent } from "./query-builder.js";
import { GraphQLExecutorTool } from "../tools/graphql-executor.js";
import { QueryValidatorTool } from "../tools/query-validator.js";
import { GraphQLSchema } from "graphql";

export interface GraphState {
  messages: string[];
  schema: GraphQLSchema;
  currentQuery: string;
  validationErrors: string[];
  executionResult: any;
}

export async function createQueryGraph(
  apiEndpoint: string,
  verbose: boolean = false,
) {
  // Create tools
  const queryBuilder = new QueryBuilderAgent(undefined, verbose);
  await queryBuilder.initialize();
  const validator = new QueryValidatorTool();
  const executor = new GraphQLExecutorTool(apiEndpoint);

  // Create the sequence
  return RunnableSequence.from([
    async (state: GraphState) => {
      if (verbose) console.log("\n=== Query Builder Step ===");
      const result = await queryBuilder.generateQuery(
        state.messages[state.messages.length - 1],
        state.schema,
      );
      if (verbose) console.log("Query builder result:", result);
      return {
        ...state,
        currentQuery: result.query,
        validationErrors: result.errors || [],
      };
    },
    async (state: GraphState) => {
      if (verbose) console.log("\n=== Query Validator Step ===");
      const validationResult = await validator._call({
        query: state.currentQuery,
        schema: state.schema,
      });
      if (verbose) console.log("Validation result:", validationResult);
      const { isValid, errors } = JSON.parse(validationResult);
      return {
        ...state,
        validationErrors: errors,
      };
    },
    async (state: GraphState) => {
      if (verbose) console.log("\n=== Query Executor Step ===");
      const result = await executor._call({
        query: state.currentQuery,
      });
      if (verbose) console.log("Execution result:", result);
      return {
        ...state,
        executionResult: JSON.parse(result),
      };
    },
  ]);
}
