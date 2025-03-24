import { config } from "dotenv";
import {
  ALL_SAMPLE_PROMPTS,
  generateChatMessages,
  type ChatMessage,
  parseChatOptions,
  handlePromptSelection,
  logChatOutput,
} from "../lib/chat.js";
import { loadLatestSchema } from "../lib/schema.js";

// Load environment variables
config();

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

// Main function to run the preview
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
