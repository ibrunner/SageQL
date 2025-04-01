import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { GraphQLClient } from "graphql-request";

const graphqlSchema = z.object({
  query: z.string().describe("The GraphQL query to execute"),
  variables: z
    .record(z.any())
    .optional()
    .describe("Optional variables for the query"),
});

export const createGraphQLExecutorTool = (endpoint: string) => {
  const client = new GraphQLClient(endpoint);

  return tool(
    async (input) => {
      try {
        const result = await client.request(input.query, input.variables);
        return JSON.stringify(result);
      } catch (error) {
        if (error instanceof Error) {
          return `Error executing GraphQL query: ${error.message}`;
        }
        return "An unknown error occurred while executing the query";
      }
    },
    {
      name: "graphql_executor",
      description: "Executes a GraphQL query against the API",
      schema: graphqlSchema,
    },
  );
};
