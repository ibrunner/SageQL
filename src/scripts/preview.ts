import {
  generateChatMessages,
  type ChatMessage,
  parseChatOptions,
  handlePromptSelection,
  logChatOutput,
} from "./chat.js";
import { loadLatestSchema } from "../lib/graphql/loadLatestSchema.js";
import { logger } from "@/lib/logger.js";
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
  logger.debug("\n=== Chat Preview ===");
  logger.debug("\nConfiguration:");
  logger.debug("Model:", process.env.OPENAI_MODEL);
  logger.debug("API Base:", process.env.OPENAI_API_BASE);
  logger.debug("\nMessages:");

  messages.forEach((msg, index) => {
    logger.debug(`\n[${index + 1}] ${msg.role.toUpperCase()}:`);
    logger.debug("-".repeat(50));
    logger.debug(msg.content);
    logger.debug("-".repeat(50));
  });

  logger.debug("\nTotal Messages:", messages.length);
  logger.debug(
    "Total Characters:",
    messages.reduce((acc, msg) => acc + msg.content.length, 0),
  );
}
