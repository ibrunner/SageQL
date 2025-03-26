import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { z } from "zod";

// Load environment variables
config();

// Environment schema
const envSchema = z.object({
  INTROSPECTION_OUTPUT_DIR: z.string(),
});

// Validate environment variables
const env = envSchema.parse(process.env);

/**
 * Loads the most recent GraphQL schema file from the configured output directory.
 * Schema files are expected to be named in the format "schema-{timestamp}.json"
 * and are sorted in reverse chronological order.
 *
 * @throws {Error} If no schema files are found in the output directory
 * @returns {string} The contents of the most recent schema file as a UTF-8 string
 *
 * @example
 * try {
 *   const schemaContent = loadLatestSchema();
 *   const parsedSchema = JSON.parse(schemaContent);
 * } catch (error) {
 *   console.error('Failed to load schema:', error.message);
 * }
 */
export function loadLatestSchema(): string {
  const outputsDir = env.INTROSPECTION_OUTPUT_DIR;
  const schemaFiles = readdirSync(outputsDir)
    .filter((file) => file.startsWith("schema-") && file.endsWith(".json"))
    .sort()
    .reverse();

  if (schemaFiles.length === 0) {
    throw new Error(
      `No schema files found in ${outputsDir}. Please run 'yarn introspect' first.`,
    );
  }

  const latestSchema = schemaFiles[0];
  const schemaPath = join(outputsDir, latestSchema);
  console.log(`Using schema from: ${latestSchema}`);

  return readFileSync(schemaPath, "utf-8");
}
