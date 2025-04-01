import { z } from "zod";
import schemaLookup, { schemaListLookup } from "../schema-lookup.js";
import { testSchema, fullCharacterSchema } from "./mocks/test-schemas.js";
import schemaCompressor from "../../schema-compressor/schema-compressor.js";
import { LookupRequest } from "../types.js";

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

  describe("Schema List Lookup", () => {
    // Sample schema for testing
    const testSchema = {
      __schema: {
        types: [
          {
            kind: "OBJECT",
            name: "User",
            description: "A user in the system",
            fields: [
              {
                name: "id",
                type: {
                  kind: "NON_NULL",
                  name: null,
                  ofType: {
                    kind: "SCALAR",
                    name: "ID",
                    description: null,
                  },
                },
              },
              {
                name: "posts",
                type: {
                  kind: "LIST",
                  name: null,
                  ofType: {
                    kind: "OBJECT",
                    name: "Post",
                    description: null,
                  },
                },
              },
            ],
          },
          {
            kind: "OBJECT",
            name: "Post",
            description: "A blog post",
            fields: [
              {
                name: "id",
                type: {
                  kind: "NON_NULL",
                  name: null,
                  ofType: {
                    kind: "SCALAR",
                    name: "ID",
                    description: null,
                  },
                },
              },
              {
                name: "author",
                type: {
                  kind: "OBJECT",
                  name: "User",
                  description: null,
                },
              },
              {
                name: "title",
                type: {
                  kind: "SCALAR",
                  name: "String",
                  description: null,
                },
              },
            ],
          },
        ],
        queryType: { name: "Query" },
      },
    };

    it("should handle a single type lookup request", () => {
      const requests: LookupRequest[] = [{ lookup: "type", id: "User" }];

      const result = schemaListLookup(testSchema, requests);

      expect(result.types).toHaveProperty("User");
      expect(result.types.User.name).toBe("User");
      expect(result.types.User.kind).toBe("OBJECT");
      expect(result.fields).toEqual({});
      expect(result.relationships).toEqual({});
      expect(result.searchResults).toEqual([]);
      expect(result.metadata.requestOrder).toEqual([
        { type: "type", id: "User" },
      ]);
      expect(Array.from(result.metadata.relatedTypes)).toEqual(["User"]);
    });

    it("should handle multiple type lookups", () => {
      const requests: LookupRequest[] = [
        { lookup: "type", id: "User" },
        { lookup: "type", id: "Post" },
      ];

      const result = schemaListLookup(testSchema, requests);

      expect(Object.keys(result.types)).toHaveLength(2);
      expect(result.types).toHaveProperty("User");
      expect(result.types).toHaveProperty("Post");
      expect(result.metadata.requestOrder).toHaveLength(2);
      expect(Array.from(result.metadata.relatedTypes)).toEqual([
        "User",
        "Post",
      ]);
    });

    it("should handle field lookups", () => {
      const requests: LookupRequest[] = [
        { lookup: "field", typeId: "User", fieldId: "posts" },
        { lookup: "field", typeId: "Post", fieldId: "author" },
      ];

      const result = schemaListLookup(testSchema, requests);

      // Check that fields exist
      expect(Object.keys(result.fields)).toContain("User.posts");
      expect(Object.keys(result.fields)).toContain("Post.author");

      // Check field types
      expect(result.fields["User.posts"].type.kind).toBe("LIST");
      expect(result.fields["Post.author"].type.name).toBe("User");

      // Check related types
      expect(Array.from(result.metadata.relatedTypes)).toContain("User");
      expect(Array.from(result.metadata.relatedTypes)).toContain("Post");
    });

    it("should handle relationship lookups", () => {
      const requests: LookupRequest[] = [
        { lookup: "relationships", typeId: "User" },
      ];

      const result = schemaListLookup(testSchema, requests);

      // Check relationships exist
      expect(Object.keys(result.relationships)).toContain("User");

      // Check outgoing relationships
      expect(Object.keys(result.relationships.User.outgoing)).toContain(
        "posts",
      );
      expect(result.relationships.User.outgoing["posts"]).toBe("Post");

      // Check incoming relationships
      expect(Object.keys(result.relationships.User.incoming)).toContain(
        "Post.author",
      );
      expect(result.relationships.User.incoming["Post.author"]).toBe("Post");
    });

    it("should handle search requests", () => {
      const requests: LookupRequest[] = [
        { lookup: "search", query: "user post", limit: 5 },
      ];

      const result = schemaListLookup(testSchema, requests);

      expect(result.searchResults).toBeInstanceOf(Array);
      expect(result.searchResults.some((r) => r.path === "User")).toBeTruthy();
      expect(result.searchResults.some((r) => r.path === "Post")).toBeTruthy();
    });

    it("should handle mixed request types", () => {
      const requests: LookupRequest[] = [
        { lookup: "type", id: "User" },
        { lookup: "field", typeId: "User", fieldId: "posts" },
        { lookup: "relationships", typeId: "User" },
        { lookup: "search", query: "user", limit: 2 },
      ];

      const result = schemaListLookup(testSchema, requests);

      // Check structure
      expect(Object.keys(result)).toEqual(
        expect.arrayContaining([
          "types",
          "fields",
          "relationships",
          "searchResults",
          "metadata",
        ]),
      );

      // Check types
      expect(Object.keys(result.types)).toContain("User");

      // Check fields
      expect(Object.keys(result.fields)).toContain("User.posts");

      // Check relationships
      expect(Object.keys(result.relationships)).toContain("User");

      // Check search results
      expect(result.searchResults.length).toBeGreaterThan(0);

      // Check metadata
      expect(result.metadata.requestOrder).toHaveLength(4);
      expect(Array.from(result.metadata.relatedTypes)).toContain("User");
      expect(Array.from(result.metadata.relatedTypes)).toContain("Post");
    });

    it("should handle duplicate requests by merging them", () => {
      const requests: LookupRequest[] = [
        { lookup: "type", id: "User" },
        { lookup: "type", id: "User" }, // Duplicate
        { lookup: "field", typeId: "User", fieldId: "posts" },
        { lookup: "field", typeId: "User", fieldId: "posts" }, // Duplicate
      ];

      const result = schemaListLookup(testSchema, requests);

      expect(Object.keys(result.types)).toHaveLength(1);
      expect(Object.keys(result.fields)).toHaveLength(1);
      // Request order should still maintain all requests
      expect(result.metadata.requestOrder).toHaveLength(4);
    });

    it("should throw error for invalid schema", () => {
      const requests: LookupRequest[] = [{ lookup: "type", id: "User" }];

      expect(() => {
        schemaListLookup({}, requests);
      }).toThrow();
    });

    it("should handle empty request array", () => {
      const result = schemaListLookup(testSchema, []);

      expect(result.types).toEqual({});
      expect(result.fields).toEqual({});
      expect(result.relationships).toEqual({});
      expect(result.searchResults).toEqual([]);
      expect(result.metadata.requestOrder).toEqual([]);
      expect(result.metadata.relatedTypes.size).toBe(0);
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
