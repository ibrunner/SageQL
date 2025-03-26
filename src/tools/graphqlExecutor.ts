import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { GraphQLClient } from "graphql-request";

const GraphQLExecutorSchema = z.object({
  query: z.string().describe("The GraphQL query to execute"),
  variables: z
    .record(z.any())
    .optional()
    .describe("Optional variables for the query"),
});

export class GraphQLExecutorTool extends StructuredTool {
  name = "graphql_executor";
  description = "Executes a GraphQL query against the API";
  schema = GraphQLExecutorSchema;
  private client: GraphQLClient;

  constructor(endpoint: string) {
    super();
    this.client = new GraphQLClient(endpoint);
  }

  async _call(input: z.infer<typeof GraphQLExecutorSchema>) {
    try {
      const result = await this.client.request(input.query, input.variables);
      return JSON.stringify(result);
    } catch (error) {
      if (error instanceof Error) {
        return `Error executing GraphQL query: ${error.message}`;
      }
      return "An unknown error occurred while executing the query";
    }
  }
}
