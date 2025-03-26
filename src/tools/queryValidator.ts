import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { parse, validate, buildClientSchema } from "graphql";

const queryValidatorSchema = z.object({
  query: z.string().describe("The GraphQL query to validate"),
  schema: z.string().describe("The GraphQL schema JSON to validate against"),
});

/**
 * Validates a GraphQL query against a provided schema
 * @async
 * @param {Object} input - The input object containing query and schema
 * @param {string} input.query - The GraphQL query string to validate
 * @param {string} input.schema - The GraphQL schema JSON string to validate against
 * @returns {Promise<string>} A JSON string containing validation results
 *   - isValid: boolean indicating if the query is valid
 *   - errors: array of error messages if validation fails
 * @throws Will return error JSON if parsing or validation fails
 * @example
 * const result = await queryValidatorTool({
 *   query: "query { user { id name } }",
 *   schema: "{...schema JSON...}"
 * });
 * // Returns: '{"isValid":true,"errors":[]}'
 */
export const queryValidatorTool = tool(
  async (input): Promise<string> => {
    try {
      const ast = parse(input.query);
      const parsedSchema = buildClientSchema(JSON.parse(input.schema));
      const validationErrors = validate(parsedSchema, ast);

      if (validationErrors.length > 0) {
        return JSON.stringify({
          isValid: false,
          errors: validationErrors.map((error) => error.message),
        });
      }

      return JSON.stringify({
        isValid: true,
        errors: [],
      });
    } catch (error) {
      if (error instanceof Error) {
        return JSON.stringify({
          isValid: false,
          errors: [error.message],
        });
      }
      return JSON.stringify({
        isValid: false,
        errors: ["An unknown error occurred while validating the query"],
      });
    }
  },
  {
    name: "query_validator",
    description: "Validates a GraphQL query against the schema",
    schema: queryValidatorSchema,
  },
);
