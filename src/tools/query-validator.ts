import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { GraphQLSchema, parse, validate, buildClientSchema } from "graphql";

const QueryValidatorSchema = z.object({
  query: z.string().describe("The GraphQL query to validate"),
  schema: z.string().describe("The GraphQL schema JSON to validate against"),
});

export class QueryValidatorTool extends StructuredTool {
  name = "query_validator";
  description = "Validates a GraphQL query against the schema";
  schema = QueryValidatorSchema;

  async _call(input: z.infer<typeof QueryValidatorSchema>) {
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
  }
}
