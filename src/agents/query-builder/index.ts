import { ChatOpenAI } from "@langchain/openai";
import { StructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { RunnableSequence } from "@langchain/core/runnables";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { AgentAction, AgentFinish } from "@langchain/core/agents";
import { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";
import { loadLatestSchema } from "../../lib/schema.js";

const QUERY_BUILDER_PROMPT = `You are a specialized GraphQL query builder agent. Your role is to:
1. Understand natural language requests and convert them into valid GraphQL queries
2. Ensure queries are optimized and follow best practices
3. Handle complex nested queries and relationships
4. Validate queries against the provided schema

You have access to the full GraphQL schema through introspection.
When generating queries:
- Use proper field selection
- Include necessary arguments
- Handle nested relationships appropriately
- Consider pagination when needed
- Use fragments for reusable query parts

Current schema:
{schema}

User request: {input}

{agent_scratchpad}

Generate a valid GraphQL query that satisfies this request.`;

export interface QueryBuilderState {
  messages: BaseMessage[];
  schema: string;
  currentQuery?: string;
  validationErrors?: string[];
}

export class QueryBuilderAgent {
  private model: ChatOpenAI;
  private prompt: ChatPromptTemplate;
  private executor!: AgentExecutor;

  constructor(modelName: string = "gpt-4-turbo-preview") {
    this.model = new ChatOpenAI({
      modelName,
      temperature: 0.1,
    });

    this.prompt = ChatPromptTemplate.fromMessages([
      ["system", QUERY_BUILDER_PROMPT],
      new MessagesPlaceholder("messages"),
    ]);
  }

  async initialize() {
    const agent = await createOpenAIFunctionsAgent({
      llm: this.model,
      prompt: this.prompt,
      tools: [],
    });

    this.executor = AgentExecutor.fromAgentAndTools({
      agent,
      tools: [],
      verbose: true,
    });
  }

  async generateQuery(
    request: string,
    schema: string,
  ): Promise<{ query: string; errors?: string[] }> {
    const state: QueryBuilderState = {
      messages: [],
      schema,
    };

    const result = await this.executor.invoke({
      input: request,
      schema,
    });

    return {
      query: result.output,
      errors: state.validationErrors,
    };
  }
}
