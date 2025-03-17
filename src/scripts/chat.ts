import { OpenAI } from "openai";
import { config } from "dotenv";
import {
  loadIntrospectionSchema,
  generateChatMessages,
  parseChatOptions,
  handlePromptSelection,
  type ChatMessage,
  logChatOutput,
} from "../lib/chat.js";

// Load environment variables
config();

// Initialize OpenAI client with Claude configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE,
});

async function chat(prompt: string, verbose = false) {
  try {
    // Load the introspection schema
    const schema = await loadIntrospectionSchema();
    const messages = generateChatMessages(prompt, schema);

    if (verbose) {
      console.log("Messages being sent to LLM:", messages);
    }

    // Get completion from Claude using OpenAI API spec
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "claude-3-sonnet-20240229",
      messages,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || undefined;
    console.log("\nAI Response:", response);
    return response;
  } catch (error) {
    console.error("Error in chat:", error);
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

  const schema = await loadIntrospectionSchema();
  const messages = generateChatMessages(selectedPrompt.prompt, schema);
  const response = await chat(selectedPrompt.prompt, options.verbose);

  if (options.logOutput) {
    logChatOutput("chat", messages, response);
  }
}

// Run the script
main().catch(console.error);
