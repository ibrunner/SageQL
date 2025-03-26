import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { schemaUnderstandingPrompts } from "../../prompts/developer/schema-understanding.js";
import { queryGenerationPrompts } from "../../prompts/developer/query-generation.js";
import { QUERY_BUILDER_PROMPT } from "../../prompts/agent/query-builder.js";
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

/**
 * Parses command line arguments to extract chat options
 * @returns {ChatOptions} Object containing parsed chat options
 */
export function parseChatOptions(): ChatOptions {
  const verbose = process.argv.includes("--verbose");
  const listPrompts = process.argv.includes("--list");
  const logOutput = process.argv.includes("--log");
  const promptName = process.argv
    .find((arg) => arg.startsWith("--prompt="))
    ?.split("=")[1];

  return { verbose, listPrompts, promptName, logOutput };
}

/**
 * Handles prompt selection based on provided options
 * @param {ChatOptions} options - Configuration options for prompt selection
 * @returns {Prompt | undefined} Selected prompt or undefined if listing prompts
 */
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

/**
 * Generates chat messages by combining the system prompt with user input
 * @param {string} prompt - User input prompt
 * @param {string} schema - GraphQL schema string
 * @returns {Promise<ChatMessage[]>} Array of formatted chat messages
 */
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

/**
 * Ensures the specified output directory exists
 * @param {string} dir - Directory path to check/create
 */
export function ensureOutputDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Logs chat interaction details to a JSON file
 * @param {"preview" | "chat"} type - Type of output being logged
 * @param {ChatMessage[]} messages - Array of chat messages
 * @param {string} [response] - Optional response content
 */
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

/**
 * Interface for chat client implementations
 */
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

/**
 * OpenAI/Claude compatible API client implementation
 */
class OpenAIClient implements ChatClient {
  private baseURL: string;
  private apiKey: string;

  /**
   * Creates a new OpenAI API client
   * @param {string} baseURL - Base URL for the API
   * @param {string} apiKey - API authentication key
   */
  constructor(baseURL: string, apiKey: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  /**
   * Sends a chat completion request to the API
   * @param {ChatMessage[]} messages - Array of chat messages
   * @param {string} model - Model identifier to use
   * @returns {Promise<any>} API response
   * @throws {Error} If the API request fails
   */
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

/**
 * Creates a chat client instance using environment configuration
 * @returns {ChatClient} Configured chat client instance
 */
export function createChatClient(): ChatClient {
  const baseURL = process.env.OPENAI_API_BASE || "";
  const apiKey = process.env.OPENAI_API_KEY || "";
  return new OpenAIClient(baseURL, apiKey);
}

/**
 * Sends chat messages using the provided client
 * @param {ChatMessage[]} messages - Array of chat messages
 * @param {string} model - Model identifier to use
 * @param {ChatClient} client - Chat client instance
 * @returns {Promise<any>} Chat completion response
 */
export async function chatWithClient(
  messages: ChatMessage[],
  model: string,
  client: ChatClient,
) {
  return client.chat(messages, model);
}
