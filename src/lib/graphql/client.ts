import { config } from "dotenv";
import fetch from "node-fetch";
import { z } from "zod";

// Load environment variables
config();

// Environment schema
const envSchema = z.object({
  GRAPHQL_API_URL: z.string().url(),
  GRAPHQL_API_HEADERS: z.string().transform((str) => JSON.parse(str)),
});

// Validate environment variables
const env = envSchema.parse(process.env);

/**
 * Represents the structure of a GraphQL API response
 * @template T - The expected type of the data payload
 */
export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: string[];
    extensions?: Record<string, any>;
  }>;
}

/**
 * A client for making GraphQL API requests
 */
export class GraphQLClient {
  private url: string;
  private headers: Record<string, string>;

  /**
   * Creates a new GraphQL client instance
   * @param url - The GraphQL API endpoint URL. Defaults to the URL from environment variables
   * @param headers - Headers to include with each request. Defaults to headers from environment variables
   */
  constructor(
    url: string = env.GRAPHQL_API_URL,
    headers: Record<string, string> = env.GRAPHQL_API_HEADERS,
  ) {
    this.url = url;
    this.headers = headers;
  }

  /**
   * Sends a GraphQL request to the API endpoint
   * @template T - The expected type of the response data
   * @param query - The GraphQL query or mutation string
   * @param variables - Optional variables to include with the query
   * @returns Promise containing the GraphQL response
   * @throws Error if the HTTP request fails or if GraphQL errors are present in the response
   */
  async request<T = any>(
    query: string,
    variables?: Record<string, any>,
  ): Promise<GraphQLResponse<T>> {
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as GraphQLResponse<T>;

      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      return data;
    } catch (error) {
      console.error("GraphQL request error:", error);
      throw error;
    }
  }
}
