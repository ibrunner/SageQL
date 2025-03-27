import { config } from "dotenv";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

// Load environment variables
config();

// Environment schema
export const llmEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
  OPENAI_API_BASE: z.string().url("OpenAI API base URL is required"),
  OPENAI_MODEL: z.string().optional(),
  GRAPHQL_API_URL: z.string().url("GraphQL API URL is required"),
});

// Validate environment variables
export const llmEnv = llmEnvSchema.parse(process.env);

export const llmModel = new ChatOpenAI({
  modelName: llmEnv.OPENAI_MODEL || "gpt-4-turbo-preview",
  temperature: 0.7,
  openAIApiKey: llmEnv.OPENAI_API_KEY,
  configuration: {
    baseURL: llmEnv.OPENAI_API_BASE,
  },
});
