import {
  generateChatMessages,
  type ChatMessage,
  parseChatOptions,
  handlePromptSelection,
  logChatOutput,
} from "./chat/chat.js";
import { loadLatestSchema } from "../lib/schema.js";

/**
 * Main execution function that:
 * 1. Parses chat options
 * 2. Handles prompt selection
 * 3. Loads the latest schema
 * 4. Generates chat messages
 * 5. Previews the chat
 * 6. Optionally logs output
 * @throws Will throw an error if any step fails
 */
async function main() {
  const options = parseChatOptions();
  const selectedPrompt = handlePromptSelection(options);

  if (!selectedPrompt) {
    return;
  }

  const schema = await loadLatestSchema();
  const messages = await generateChatMessages(selectedPrompt.prompt, schema);
  previewChat(messages);

  if (options.logOutput) {
    logChatOutput("preview", messages);
  }
}

// Run the script
main().catch(console.error);

/**
 * Displays a preview of the chat messages including configuration and message details
 * @param messages - Array of ChatMessage objects containing role and content
 */
function previewChat(messages: ChatMessage[]) {
  console.log("\n=== Chat Preview ===");
  console.log("\nConfiguration:");
  console.log("Model:", process.env.OPENAI_MODEL || "claude-3-sonnet-20240229");
  console.log("API Base:", process.env.OPENAI_API_BASE);
  console.log("\nMessages:");

  messages.forEach((msg, index) => {
    console.log(`\n[${index + 1}] ${msg.role.toUpperCase()}:`);
    console.log("-".repeat(50));
    console.log(msg.content);
    console.log("-".repeat(50));
  });

  console.log("\nTotal Messages:", messages.length);
  console.log(
    "Total Characters:",
    messages.reduce((acc, msg) => acc + msg.content.length, 0),
  );
}
