import { config } from "dotenv";
import {
  loadIntrospectionSchema,
  generateChatMessages,
  parseChatOptions,
  handlePromptSelection,
  type ChatMessage,
  logChatOutput,
  createChatClient,
  chatWithClient,
} from "../lib/chat.js";

// Load environment variables
config();

// Initialize the chat client
const chatClient = createChatClient();

async function chat(prompt: string, verbose = false) {
  try {
    // Load the introspection schema
    const schema = await loadIntrospectionSchema();
    const messages = generateChatMessages(prompt, schema);

    if (verbose) {
      console.log("Messages being sent to LLM:", messages);
    }

    // Get completion using the generic chat client
    const completion = await chatWithClient(
      messages,
      process.env.OPENAI_MODEL || "claude-3-sonnet-20240229",
      chatClient,
    );

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
