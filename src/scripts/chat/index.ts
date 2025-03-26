import { config } from "dotenv";
import {
  generateChatMessages,
  parseChatOptions,
  handlePromptSelection,
  type ChatMessage,
  logChatOutput,
  chatWithClient,
} from "./chat.js";
import { loadLatestSchema } from "../../lib/schema.js";

// Load environment variables
config();

async function chat(prompt: string, verbose = false) {
  try {
    // Load the introspection schema
    const schema = await loadLatestSchema();
    const messages = await generateChatMessages(prompt, schema);

    if (verbose) {
      console.log("Messages being sent to LLM:", messages);
    }

    // Get completion using the generic chat client
    const completion = await chatWithClient(messages);

    const response =
      completion.choices[0]?.message?.content?.toString() || undefined;
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

  const schema = await loadLatestSchema();
  const messages = await generateChatMessages(selectedPrompt.prompt, schema);
  const response = await chat(selectedPrompt.prompt, options.verbose);

  if (options.logOutput) {
    logChatOutput("chat", messages, response);
  }
}

// Run the script
main().catch(console.error);
