import { SystemMessagePromptTemplate } from "@langchain/core/prompts";

export const EXECUTION_RETRY_PROMPT =
  SystemMessagePromptTemplate.fromTemplate(`The previous query failed with an execution error. Please review and fix the issues:

Error: {errorMessage}

Previous query that failed:
{failedQuery}

Please generate a new query that:
1. Uses ONLY the exact field names from the schema
2. Includes ONLY fields that are directly relevant to the request
3. Uses ONLY the arguments defined in the schema
4. Maintains the original intent of the query
5. Follows proper GraphQL syntax

Schema context:
{schemaContext}`);
