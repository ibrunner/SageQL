import {
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "fs";
import { join } from "path";
import { schemaUnderstandingPrompts } from "../scripts/prompts/schema-understanding.js";
import { queryGenerationPrompts } from "../scripts/prompts/query-generation.js";

// System prompt for the AI
export const SYSTEM_PROMPT = `You are an AI assistant specialized in helping users interact with GraphQL APIs.
Your role is to:
1. Understand the GraphQL schema provided to you
2. Help users formulate queries and understand the API
3. Generate appropriate GraphQL queries based on user requests
4. Explain query results in a clear, concise manner

You have access to the complete GraphQL schema through the introspection query results.
Always validate queries against the schema before suggesting them.
If a user's request is unclear, ask for clarification.

When generating queries:
1. Use proper GraphQL syntax
2. Include only the fields that are explicitly requested
3. Handle relationships appropriately
4. Consider pagination for large result sets
5. Validate the query against the schema before returning it`;

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

export function generateChatMessages(
  prompt: string,
  schema: string,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "system",
      content: `Here is the GraphQL schema:\n${schema}`,
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
