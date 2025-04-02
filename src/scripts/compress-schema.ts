import { config } from "dotenv";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { loadLatestSchema } from "../lib/graphql/load-latest-schema.js";
import schemaCompressor from "../lib/graphql/schema-compressor/schema-compressor.js";
import { logger } from "../lib/logger.js";

config();

interface SchemaData {
  __schema?: {
    queryType?: { name: string };
    mutationType?: { name: string };
    subscriptionType?: { name: string };
    types: any[];
    directives?: any[];
  };
}

async function compressAndSaveSchema() {
  try {
    logger.info("Loading latest schema...");
    const loadedSchemaStr = loadLatestSchema();
    const loadedSchema = JSON.parse(loadedSchemaStr) as SchemaData;

    // Ensure schema has the correct structure
    const schemaJson = loadedSchema.__schema
      ? loadedSchema
      : { __schema: loadedSchema };

    logger.info("Compressing schema...");
    const compressedSchema = schemaCompressor(schemaJson, {
      removeDescriptions: false,
      preserveEssentialDescriptions: true,
      removeDeprecated: true,
      removeIntrospectionTypes: true,
    });

    // Create compressed output directory if it doesn't exist
    const compressedOutputDir = join(process.cwd(), "outputs", "compressed");
    await mkdir(compressedOutputDir, { recursive: true });

    // Generate timestamped filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputFile = join(
      compressedOutputDir,
      `schema-compressed-${timestamp}.json`,
    );

    // Save compressed schema
    await writeFile(outputFile, JSON.stringify(compressedSchema, null, 2));
    logger.info(`Compressed schema saved to ${outputFile}`);

    // Log compression stats
    const originalSize = Buffer.from(JSON.stringify(schemaJson)).length;
    const compressedSize = Buffer.from(JSON.stringify(compressedSchema)).length;
    const compressionRatio =
      ((originalSize - compressedSize) / originalSize) * 100;

    logger.info("\nCompression Statistics:");
    logger.info(`Original Size: ${(originalSize / 1024).toFixed(2)} KB`);
    logger.info(`Compressed Size: ${(compressedSize / 1024).toFixed(2)} KB`);
    logger.info(`Compression Ratio: ${compressionRatio.toFixed(2)}%`);
  } catch (error) {
    logger.error("Error compressing schema:");
    if (error instanceof Error) {
      logger.error("Error name:", error.name);
      logger.error("Error message:", error.message);
      logger.error("Error stack:", error.stack);
    } else {
      logger.error("Unknown error:", error);
    }
    process.exit(1);
  }
}

compressAndSaveSchema();
