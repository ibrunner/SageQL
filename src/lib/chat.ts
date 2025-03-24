import {
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "fs";
import { join } from "path";
import { schemaUnderstandingPrompts } from "../prompts/developer/schema-understanding.js";
import { queryGenerationPrompts } from "../prompts/developer/query-generation.js";
import { QUERY_BUILDER_PROMPT } from "../prompts/agent/query-builder.js";
// System prompt for the AI

// Combine all sample prompts
export const ALL_SAMPLE_PROMPTS = [
  ...schemaUnderstandingPrompts,
  ...queryGenerationPrompts,
];

export interface Prompt {
  name: string;
  prompt: string;
  expected: string;
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface ChatOptions {
  verbose?: boolean;
  listPrompts?: boolean;
  promptName?: string;
  logOutput?: boolean;
}

export function parseChatOptions(): ChatOptions {
  const verbose = process.argv.includes("--verbose");
  const listPrompts = process.argv.includes("--list");
  const logOutput = process.argv.includes("--log");
  const promptName = process.argv
    .find((arg) => arg.startsWith("--prompt="))
    ?.split("=")[1];

  return { verbose, listPrompts, promptName, logOutput };
}

export function handlePromptSelection(
  options: ChatOptions,
): Prompt | undefined {
  if (options.listPrompts) {
    console.log("Available prompts:");
    ALL_SAMPLE_PROMPTS.forEach((p) => console.log(`- ${p.name}`));
    return undefined;
  }

  const selectedPrompt = options.promptName
    ? getPromptByName(options.promptName)
    : getRandomPrompt();

  if (!selectedPrompt && options.promptName) {
    console.error(
      `Prompt "${options.promptName}" not found. Use --list to see available prompts.`,
    );
    return undefined;
  }

  if (options.verbose && selectedPrompt) {
    console.log("Selected prompt:", selectedPrompt.name);
    console.log("Prompt text:", selectedPrompt.prompt);
    console.log("Expected output:", selectedPrompt.expected);
  }

  return selectedPrompt;
}

export async function loadIntrospectionSchema(): Promise<string> {
  try {
    const outputsDir = join(process.cwd(), "outputs", "graphql");
    const files = readdirSync(outputsDir);

    // Find all schema files that match the ISO 8601 timestamp pattern
    const schemaFiles = files.filter((f) => {
      // Match files like schema-2025-03-17T15-25-40-641Z.json
      const match = f.match(
        /^schema-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.json$/,
      );
      return match !== null;
    });

    if (schemaFiles.length === 0) {
      throw new Error(
        "No timestamped schema files found in outputs/graphql directory",
      );
    }

    // Sort by the timestamp in the filename (ISO 8601 format)
    const latestSchema = schemaFiles.sort().reverse()[0];
    const schemaPath = join(outputsDir, latestSchema);

    console.log(`Loading schema from: ${latestSchema}`);
    const schema = readFileSync(schemaPath, "utf-8");
    return schema;
  } catch (error) {
    console.error("Error loading introspection schema:", error);
    throw error;
  }
}

export function getRandomPrompt(): Prompt {
  const randomIndex = Math.floor(Math.random() * ALL_SAMPLE_PROMPTS.length);
  const prompt = ALL_SAMPLE_PROMPTS[randomIndex];
  return {
    name: prompt.name,
    prompt: prompt.prompt,
    expected: prompt.expected,
  };
}

export function getPromptByName(name: string): Prompt | undefined {
  return ALL_SAMPLE_PROMPTS.find((p) => p.name === name);
}

export async function generateChatMessages(
  prompt: string,
  schema: string,
): Promise<ChatMessage[]> {
  const formattedPrompt = await QUERY_BUILDER_PROMPT.format({ schema });
  return [
    {
      role: "system",
      content: formattedPrompt,
    },
    {
      role: "user",
      content: prompt,
    },
  ];
}

export function ensureOutputDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function logChatOutput(
  type: "preview" | "chat",
  messages: ChatMessage[],
  response?: string,
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputsDir = join(process.cwd(), "outputs", type);
  ensureOutputDir(outputsDir);

  const output = {
    timestamp,
    messages,
    response,
    metadata: {
      model: process.env.OPENAI_MODEL || "claude-3-sonnet-20240229",
      apiBase: process.env.OPENAI_API_BASE,
    },
  };

  const filename = `${type}-${timestamp}.json`;
  const filepath = join(outputsDir, filename);
  writeFileSync(filepath, JSON.stringify(output, null, 2));
  console.log(`\nLogged output to: ${filename}`);
}

// Chat client interface
interface ChatClient {
  chat(
    messages: ChatMessage[],
    model: string,
  ): Promise<{
    choices: Array<{
      message: {
        content: string;
      };
    }>;
  }>;
}

// OpenAI/Claude compatible client
class OpenAIClient implements ChatClient {
  private baseURL: string;
  private apiKey: string;

  constructor(baseURL: string, apiKey: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  async chat(messages: ChatMessage[], model: string) {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

// Ollama compatible client
class OllamaClient implements ChatClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async chat(messages: ChatMessage[], model: string) {
    const prompt = messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n\n");

    const response = await fetch(this.baseURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      choices: [
        {
          message: {
            content: data.response,
          },
        },
      ],
    };
  }
}

// Factory function to create the appropriate client
export function createChatClient(): ChatClient {
  const baseURL = process.env.OPENAI_API_BASE || "";
  const apiKey = process.env.OPENAI_API_KEY || "";

  // Check if we're using Ollama (by checking if the base URL contains /api/generate)
  if (baseURL.includes("/api/generate")) {
    return new OllamaClient(baseURL);
  }

  // Default to OpenAI/Claude compatible client
  return new OpenAIClient(baseURL, apiKey);
}

// Generic chat function that works with any client
export async function chatWithClient(
  messages: ChatMessage[],
  model: string,
  client: ChatClient,
) {
  return client.chat(messages, model);
}
