import { config } from "dotenv";
import { writeFile, symlink, unlink } from "fs/promises";
import { join } from "path";
import {
  ApolloClient,
  InMemoryCache,
  gql,
  ApolloError,
} from "@apollo/client/core";
import { z } from "zod";

// Load environment variables
config();

// Environment schema
const envSchema = z.object({
  GRAPHQL_API_URL: z.string().url(),
  GRAPHQL_API_HEADERS: z.string().transform((str) => JSON.parse(str)),
  INTROSPECTION_OUTPUT_DIR: z.string(),
});

// Validate environment variables
const env = envSchema.parse(process.env);

// Create Apollo Client
const client = new ApolloClient({
  uri: env.GRAPHQL_API_URL,
  headers: env.GRAPHQL_API_HEADERS,
  cache: new InMemoryCache(),
});

// The introspection query
const INTROSPECTION_QUERY = gql`
  query IntrospectionQuery {
    __schema {
      queryType {
        name
      }
      mutationType {
        name
      }
      subscriptionType {
        name
      }
      types {
        ...FullType
      }
      directives {
        name
        description
        locations
        args {
          ...InputValue
        }
      }
    }
  }

  fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }

  fragment InputValue on __InputValue {
    name
    description
    type {
      ...TypeRef
    }
    defaultValue
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
        }
      }
    }
  }
`;

/**
 * Fetches and saves the GraphQL schema introspection data
 * @async
 * @throws {ApolloError} When there are GraphQL-related errors during fetching
 * @throws {Error} When there are file system errors during schema saving
 * @description
 * This function:
 * 1. Queries the GraphQL endpoint for schema introspection
 * 2. Logs detailed schema information including types and directives
 * 3. Saves the schema to a timestamped JSON file
 * 4. Handles and logs various types of errors (network, GraphQL, protocol, client)
 */
async function fetchIntrospection() {
  try {
    console.log("Fetching GraphQL schema...");
    console.log("Request URL:", env.GRAPHQL_API_URL);

    const { data } = await client.query({
      query: INTROSPECTION_QUERY,
    });

    // Log detailed schema information
    console.log("\nSchema Information:");
    console.log("Query Type:", data.__schema.queryType?.name);
    console.log("Mutation Type:", data.__schema.mutationType?.name);
    console.log("Subscription Type:", data.__schema.subscriptionType?.name);
    console.log("Number of Types:", data.__schema.types.length);
    console.log("Number of Directives:", data.__schema.directives.length);

    // Log all types
    console.log("\nTypes:");
    data.__schema.types.forEach((type: any) => {
      if (type.name && !type.name.startsWith("__")) {
        console.log(`- ${type.name} (${type.kind})`);
        if (type.description) {
          console.log(`  Description: ${type.description}`);
        }
        if (type.fields) {
          console.log(`  Fields: ${type.fields.length}`);
        }
      }
    });

    // Log all directives
    console.log("\nDirectives:");
    data.__schema.directives.forEach((directive: any) => {
      console.log(`- ${directive.name}`);
      if (directive.description) {
        console.log(`  Description: ${directive.description}`);
      }
      console.log(`  Locations: ${directive.locations.join(", ")}`);
    });

    // Generate timestamped filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputFile = join(
      env.INTROSPECTION_OUTPUT_DIR,
      `schema-${timestamp}.json`,
    );

    // Save schema file
    try {
      await writeFile(outputFile, JSON.stringify(data, null, 2));
      console.log(`\nSchema saved to ${outputFile}`);
    } catch (error) {
      console.error("Error saving schema file:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error fetching schema:");

    if (error instanceof ApolloError) {
      // Log network errors
      if (error.networkError) {
        console.error("Network Error:", error.networkError);
        const networkError = error.networkError as { result?: any };
        if (networkError.result) {
          console.error(
            "Error Result:",
            JSON.stringify(networkError.result, null, 2),
          );
        }
      }

      // Log GraphQL errors
      if (error.graphQLErrors.length > 0) {
        console.error(
          "GraphQL Errors:",
          JSON.stringify(error.graphQLErrors, null, 2),
        );
      }

      // Log protocol errors
      if (error.protocolErrors.length > 0) {
        console.error(
          "Protocol Errors:",
          JSON.stringify(error.protocolErrors, null, 2),
        );
      }

      // Log client errors
      if (error.clientErrors.length > 0) {
        console.error(
          "Client Errors:",
          JSON.stringify(error.clientErrors, null, 2),
        );
      }
    } else {
      console.error("Unknown error:", error);
    }

    process.exit(1);
  }
}

fetchIntrospection();
