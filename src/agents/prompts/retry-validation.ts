import { SystemMessagePromptTemplate } from "@langchain/core/prompts";

interface ValidationVariables {
  validationContext: string;
  failedQuery: string;
  schemaContext: string;
  fieldErrors?: string;
  fieldSuggestions?: string;
  argumentErrors?: string;
  typeErrors?: string;
  filterErrors?: string;
}

const BASE_VALIDATION_PROMPT = `The previous query failed with validation errors. Please fix these issues while maintaining the original query intent:

{validationContext}

Previous query that failed:
{failedQuery}

Please generate a new query that:
1. Maintains the original query intent
2. Uses ONLY the exact field names from the schema
3. Includes ONLY fields that are directly relevant to the request
4. Uses ONLY the arguments defined in the schema
5. Follows proper GraphQL syntax
6. Keeps the same field selection structure
7. Follows standard GraphQL patterns:
   - Check for connection/pagination patterns (e.g., edges, nodes, or results fields)
   - Verify parent/child relationships in the schema
   - Use proper argument types as defined in the schema
   - Follow any interface or union type requirements

Schema context:
{schemaContext}`;

export const VALIDATION_RETRY_PROMPT = SystemMessagePromptTemplate.fromTemplate(
  BASE_VALIDATION_PROMPT,
);

function formatSuggestions(hasFieldSuggestions: boolean): string {
  return hasFieldSuggestions
    ? `
7. Uses the suggested field names where applicable
8. Replaces any incorrect field names with their correct versions from the schema`
    : "";
}

function formatFilterRules(
  hasFieldSuggestions: boolean,
  hasFilterErrors: boolean,
): string {
  return hasFilterErrors
    ? `
${hasFieldSuggestions ? "9" : "7"}. Uses the correct filter codes and structures
${hasFieldSuggestions ? "10" : "8"}. Follows the filter guidelines for continents, countries, and languages`
    : "";
}

export const ERROR_TEMPLATES = {
  fieldName: (variables: ValidationVariables): string => {
    const { fieldErrors, fieldSuggestions } = variables;
    if (!fieldErrors) return "";

    let message = `Field Name Errors:
${fieldErrors}`;

    if (fieldSuggestions) {
      message += `\nSuggested field names to use:
${fieldSuggestions}`;
    }

    message +=
      "\nPlease use ONLY the exact field names from the schema. Do not guess or abbreviate field names.";
    return message;
  },

  argument: (variables: ValidationVariables): string => {
    const { argumentErrors } = variables;
    if (!argumentErrors) return "";

    return `Argument Errors:
${argumentErrors}
Please use ONLY the arguments defined in the schema.`;
  },

  type: (variables: ValidationVariables): string => {
    const { typeErrors } = variables;
    if (!typeErrors) return "";

    return `Type Errors:
${typeErrors}
Please ensure all field types match the schema exactly.`;
  },

  filter: (variables: ValidationVariables): string => {
    const { filterErrors } = variables;
    if (!filterErrors) return "";

    return `Filter Errors:
${filterErrors}
Please ensure filters follow these guidelines:
1. Use standard two-letter codes for continents (e.g., "EU" for Europe)
2. Use ISO codes for countries and languages
3. Follow the exact filter structure from the schema
4. Check the schema for the correct filter input type`;
  },
};
