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
