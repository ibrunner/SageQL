import { z } from "zod";
import schemaLookup from "../schema-lookup.js";
import { testSchema, fullCharacterSchema } from "./mocks/test-schemas.js";
import schemaCompressor from "../../schema-compressor/schema-compressor.js";

describe("Schema Lookup", () => {
  describe("Schema Validation", () => {
    it("should validate a valid schema", () => {
      expect(() =>
        schemaLookup(fullCharacterSchema, { lookup: "type", id: "Character" }),
      ).not.toThrow();
    });

    it("should reject an invalid schema", () => {
      const invalidSchema = {
        __schema: {
          types: [
            {
              // Missing required 'kind' field
              name: "Character",
              fields: [],
            },
          ],
        },
      };
      expect(() =>
        schemaLookup(invalidSchema, { lookup: "type", id: "Character" }),
      ).toThrow(z.ZodError);
    });
  });

  describe("Type Lookup", () => {
    it("should look up a type by ID", () => {
      const result = schemaLookup(testSchema, {
        lookup: "type",
        id: "Character",
      });
      expect(result).toEqual(
        testSchema.__schema.types.find((t) => t.name === "Character"),
      );
    });

    it("should throw error for non-existent type", () => {
      expect(() =>
        schemaLookup(testSchema, { lookup: "type", id: "NonExistent" }),
      ).toThrow("Type not found: NonExistent");
    });
  });

  describe("Field Lookup", () => {
    it("should look up a field by type and field ID", () => {
      const result = schemaLookup(testSchema, {
        lookup: "field",
        typeId: "Character",
        fieldId: "status",
      });
      const characterType = testSchema.__schema.types.find(
        (t) => t.name === "Character",
      );
      const statusField = characterType?.fields?.find(
        (f) => f.name === "status",
      );
      expect(result).toEqual(statusField);
    });

    it("should throw error for non-existent field", () => {
      expect(() =>
        schemaLookup(testSchema, {
          lookup: "field",
          typeId: "Character",
          fieldId: "nonExistent",
        }),
      ).toThrow("Field not found: nonExistent on type Character");
    });
  });

  describe("Compressed Schema Lookup", () => {
    it("should successfully compress schema and look up a type by ID", () => {
      // First compress the schema
      const compressedSchema = schemaCompressor(testSchema);

      // Look up a type in the compressed schema
      const compressedCharacterType = compressedSchema.types.Character;
      expect(compressedCharacterType).toBeDefined();
      expect(compressedCharacterType.name).toBe("Character");

      // Look up the same type in the original schema using schema-lookup
      const originalCharacterType = schemaLookup(testSchema, {
        lookup: "type",
        id: "Character",
      }) as any; // Type assertion since we know this returns a type lookup
      expect(originalCharacterType).toBeDefined();

      // Compare key properties between compressed and original
      expect(compressedCharacterType.name).toBe(originalCharacterType.name);
      expect(compressedCharacterType.kind).toBe(originalCharacterType.kind);
      expect(compressedCharacterType.description).toBe(
        originalCharacterType.description,
      );

      // Compare fields (accounting for type normalization in compressed schema)
      const compressedFields = compressedCharacterType.fields;
      const originalFields = originalCharacterType.fields;
      expect(compressedFields.length).toBe(originalFields.length);

      // Check a specific field in detail
      const compressedStatusField = compressedFields.find(
        (f: any) => f.name === "status",
      );
      const originalStatusField = originalFields.find(
        (f: any) => f.name === "status",
      );
      expect(compressedStatusField).toBeDefined();
      expect(originalStatusField).toBeDefined();
      expect(compressedStatusField.name).toBe(originalStatusField.name);
      expect(compressedStatusField.description).toBe(
        originalStatusField.description,
      );
    });

    it("should maintain field relationships after compression", () => {
      const compressedSchema = schemaCompressor(testSchema);

      // Check that Character -> Episode relationship is preserved
      const characterType = schemaLookup(testSchema, {
        lookup: "type",
        id: "Character",
      }) as any; // Type assertion since we know this returns a type lookup
      const episodesField = characterType.fields.find(
        (f: any) => f.name === "episodes",
      );
      expect(episodesField).toBeDefined();

      // Check the compressed version maintains this relationship
      const compressedCharacter = compressedSchema.types.Character;
      const compressedEpisodesField = compressedCharacter.fields.find(
        (f: any) => f.name === "episodes",
      );
      expect(compressedEpisodesField).toBeDefined();
      expect(compressedEpisodesField.type).toBe("[Episode]!"); // Normalized type notation
    });
  });
  // describe("Relationships Lookup", () => {
  //   it("should find outgoing and incoming relationships", () => {
  //     const result = schemaLookup(testSchema, {
  //       lookup: "relationships",
  //       typeId: "Character",
  //     });
  //     expect(result).toEqual({
  //       outgoing: {
  //         episodes: "Episode",
  //       },
  //       incoming: {
  //         "Episode.characters": "Episode",
  //       },
  //     });
  //   });

  //   it("should return empty relationships for scalar types", () => {
  //     const schemaWithScalar = {
  //       __schema: {
  //         types: [
  //           ...testSchema.__schema.types,
  //           {
  //             __typename: "__Type",
  //             kind: "SCALAR",
  //             name: "DateTime",
  //             description: "ISO-8601 encoded UTC date string",
  //             fields: null,
  //             interfaces: [],
  //             enumValues: null,
  //             possibleTypes: null,
  //           },
  //         ],
  //         queryType: testSchema.__schema.queryType,
  //         mutationType: null,
  //         subscriptionType: null,
  //         directives: [],
  //       },
  //     };
  //     const result = schemaLookup(schemaWithScalar, {
  //       lookup: "relationships",
  //       typeId: "DateTime",
  //     });
  //     expect(result).toEqual({
  //       outgoing: {},
  //       incoming: {},
  //     });
  //   });
  // });

  // describe("Search", () => {
  //   it("should find matching types and fields", () => {
  //     const result = schemaLookup(testSchema, {
  //       lookup: "search",
  //       query: "character",
  //       limit: 3,
  //     }) as SearchLookupResponse;
  //     expect(result.results).toHaveLength(3);
  //     expect(result.results[0].path).toBe("Character");
  //     expect(result.results[0].relevance).toBeGreaterThan(0);
  //   });

  //   it("should respect search limit", () => {
  //     const result = schemaLookup(testSchema, {
  //       lookup: "search",
  //       query: "character",
  //       limit: 1,
  //     }) as SearchLookupResponse;
  //     expect(result.results).toHaveLength(1);
  //   });

  //   it("should sort results by relevance", () => {
  //     const result = schemaLookup(testSchema, {
  //       lookup: "search",
  //       query: "character status",
  //       limit: 5,
  //     }) as SearchLookupResponse;
  //     expect(result.results[0].relevance).toBeGreaterThanOrEqual(
  //       result.results[1].relevance,
  //     );
  //   });
  // });

  // describe("Pattern Lookup", () => {
  //   it("should look up and apply a pattern", () => {
  //     const result = schemaLookup(testSchema, {
  //       lookup: "pattern",
  //       patternName: "connection",
  //       params: { item: "Character" },
  //     });
  //     expect(result).toEqual({
  //       kind: "OBJECT",
  //       fields: [
  //         { name: "info", type: "Info" },
  //         { name: "results", type: "[Character]" },
  //       ],
  //     });
  //   });

  //   it("should throw error for non-existent pattern", () => {
  //     expect(() =>
  //       schemaLookup(testSchema, {
  //         lookup: "pattern",
  //         patternName: "nonExistent",
  //         params: {},
  //       }),
  //     ).toThrow("Pattern not found: nonExistent");
  //   });
  // });
});
