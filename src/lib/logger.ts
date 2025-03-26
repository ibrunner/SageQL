// Get verbose flag from process arguments
const isVerbose = process.argv.includes("--verbose");

/**
 * Creates a prefixed message if a prefix is provided
 */
const formatMessage = (prefix: string | undefined, message: string) => {
  return prefix ? `[${prefix}] ${message}` : message;
};

/**
 * Debug level logging - only shown when --verbose flag is used
 */
export function debug(message: string, data?: any, prefix?: string) {
  if (isVerbose) {
    console.log(formatMessage(prefix, message));
    if (data !== undefined) {
      console.log(data);
    }
  }
}

/**
 * Info level logging - always shown
 */
export function info(message: string, data?: any, prefix?: string) {
  console.log(formatMessage(prefix, message));
  if (data !== undefined) {
    console.log(data);
  }
}

/**
 * Error level logging - always shown
 */
export function error(message: string, error?: any, prefix?: string) {
  console.error(formatMessage(prefix, message));
  if (error !== undefined) {
    console.error(error);
  }
}

// Export a namespace for easier imports
export const logger = {
  debug,
  info,
  error,
};
