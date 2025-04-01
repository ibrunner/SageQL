import { BaseMessage, MessageContent } from "@langchain/core/messages";

/**
 * Converts MessageContent or BaseMessage from langchain to string representation
 */
export function getMessageString(
  content: MessageContent | BaseMessage,
): string {
  if (content instanceof BaseMessage) {
    return getMessageString(content.content);
  }
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .join(" ");
  }
  return JSON.stringify(content);
}
