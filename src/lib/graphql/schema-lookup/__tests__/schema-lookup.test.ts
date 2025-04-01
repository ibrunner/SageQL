import { z } from "zod";
import schemaLookup from "../schema-lookup.js";
import { SearchLookupResponse } from "../types.js";
import { testSchema, fullCharacterSchema } from "./mocks/test-schemas.js";

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
