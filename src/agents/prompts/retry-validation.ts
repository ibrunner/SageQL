import { SystemMessagePromptTemplate } from "@langchain/core/prompts";

export const VALIDATION_RETRY_PROMPT =
  SystemMessagePromptTemplate.fromTemplate(`The previous query failed with validation errors. Please fix these issues while maintaining the original query intent:

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
{#if hasFieldSuggestions}
7. Uses the suggested field names where applicable
8. Replaces any incorrect field names with their correct versions from the schema
{/if}
{#if hasFilterErrors}
{#if hasFieldSuggestions}9{else}7{/if}. Uses the correct filter codes and structures
{#if hasFieldSuggestions}10{else}8{/if}. Follows the filter guidelines for continents, countries, and languages
{/if}

Schema context:
{schemaContext}`);

export const ERROR_TEMPLATES = {
  fieldName: `{#if fieldErrors}
Field Name Errors:
{fieldErrors}
{#if fieldSuggestions}
Suggested field names to use:
{fieldSuggestions}
{/if}
Please use ONLY the exact field names from the schema. Do not guess or abbreviate field names.
{/if}`,

  argument: `{#if argumentErrors}
Argument Errors:
{argumentErrors}
Please use ONLY the arguments defined in the schema.
{/if}`,

  type: `{#if typeErrors}
Type Errors:
{typeErrors}
Please ensure all field types match the schema exactly.
{/if}`,

  filter: `{#if filterErrors}
Filter Errors:
{filterErrors}
Please ensure filters follow these guidelines:
1. Use standard two-letter codes for continents (e.g., "EU" for Europe)
2. Use ISO codes for countries and languages
3. Follow the exact filter structure from the schema
4. Check the schema for the correct filter input type
{/if}`,
};
