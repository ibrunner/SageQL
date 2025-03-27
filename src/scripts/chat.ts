import { config } from "dotenv";
import { loadLatestSchema } from "../lib/graphql/loadLatestSchema.js";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { schemaUnderstandingPrompts } from "./prompts/schemaUnderstanding.js";
import { queryGenerationPrompts } from "./prompts/queryGeneration.js";
import { QUERY_BUILDER_PROMPT } from "../agents/prompts/queryBuilder.js";
import { llmModel, llmEnv } from "../lib/llmClient.js";
import { logger } from "@/lib/logger.js";

// Load environment variables
config();

async function chat(prompt: string) {
  try {
    // Load the introspection schema
    const schema = await loadLatestSchema();
    const messages = await generateChatMessages(prompt, schema);

    logger.debug("Messages being sent to LLM:", messages);

    // Get completion using the generic chat client
    const completion = await chatWithClient(messages);

    const response =
      completion.choices[0]?.message?.content?.toString() || undefined;
    logger.info("\nAI Response:", response);
    return response;
  } catch (error) {
    logger.error("Error in chat:", error);
    throw error;
  }
}

// Main function to run the chat
async function main() {
  const options = parseChatOptions();
  const selectedPrompt = handlePromptSelection(options);

  if (!selectedPrompt) {
    return;
  }

  const schema = await loadLatestSchema();
  const messages = await generateChatMessages(selectedPrompt.prompt, schema);
  const response = await chat(selectedPrompt.prompt);

  if (options.logOutput) {
    logChatOutput("chat", messages, response);
  }
}

// Run the script
main().catch(console.error);

// Combine all sample prompts
const ALL_SAMPLE_PROMPTS = [
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
  type?: "system" | "user"; // Added for LangChain compatibility
}

export interface ChatOptions {
  listPrompts?: boolean;
  promptName?: string;
  logOutput?: boolean;
}

/**
 * Parses command line arguments to extract chat options
 * @returns {ChatOptions} Object containing parsed chat options
 */
export function parseChatOptions(): ChatOptions {
  const listPrompts = process.argv.includes("--list");
  const logOutput = process.argv.includes("--log");
  const promptName = process.argv
    .find((arg) => arg.startsWith("--prompt="))
    ?.split("=")[1];

  return { listPrompts, promptName, logOutput };
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
    logger.debug("Available prompts:");
    ALL_SAMPLE_PROMPTS.forEach((p) => logger.debug(`- ${p.name}`));
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

  if (selectedPrompt) {
    logger.debug("Selected prompt:", selectedPrompt.name);
    logger.debug("Prompt text:", selectedPrompt.prompt);
    logger.debug("Expected output:", selectedPrompt.expected);
  }

  return selectedPrompt;
}

function getRandomPrompt(): Prompt {
  const randomIndex = Math.floor(Math.random() * ALL_SAMPLE_PROMPTS.length);
  const prompt = ALL_SAMPLE_PROMPTS[randomIndex];
  return {
    name: prompt.name,
    prompt: prompt.prompt,
    expected: prompt.expected,
  };
}

function getPromptByName(name: string): Prompt | undefined {
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
function ensureOutputDir(dir: string) {
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
      model: llmEnv.OPENAI_MODEL,
      apiBase: llmEnv.OPENAI_API_BASE,
    },
  };

  const filename = `${type}-${timestamp}.json`;
  const filepath = join(outputsDir, filename);
  writeFileSync(filepath, JSON.stringify(output, null, 2));
  logger.info(`\nLogged output to: ${filename}`);
}

/**
 * Sends chat messages using the LangChain ChatOpenAI client
 * @param {ChatMessage[]} messages - Array of chat messages
 * @returns {Promise<any>} Chat completion response
 */
async function chatWithClient(messages: ChatMessage[]) {
  try {
    const langChainMessages = messages.map((msg) => ({
      ...msg,
      type: msg.role, // Map role to type for LangChain
    }));
    const response = await llmModel.invoke(langChainMessages);
    return {
      choices: [
        {
          message: {
            content: response.content,
          },
        },
      ],
    };
  } catch (error) {
    throw new Error(`LLM error: ${error}`);
  }
}
