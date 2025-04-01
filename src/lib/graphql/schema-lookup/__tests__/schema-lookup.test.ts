import { z } from "zod";
import schemaLookup, { SearchLookupResponse } from "../schema-lookup.js";

// Test schema based on Rick and Morty API
const testSchema = {
  types: {
    Character: {
      kind: "OBJECT",
      name: "Character",
      description: "A character from the Rick and Morty universe",
      fields: [
        {
          name: "id",
          type: "ID",
          description: "The id of the character.",
        },
        {
          name: "name",
          type: "String",
          description: "The name of the character.",
        },
        {
          name: "status",
          type: "String",
          description:
            "The status of the character ('Alive', 'Dead' or 'unknown').",
        },
        {
          name: "episodes",
          type: "[Episode]!",
          description: "Episodes in which this character appeared.",
        },
      ],
    },
    Episode: {
      kind: "OBJECT",
      name: "Episode",
      description: "A single episode of the series",
      fields: [
        {
          name: "id",
          type: "ID",
          description: "The id of the episode.",
        },
        {
          name: "name",
          type: "String",
          description: "The name of the episode.",
        },
        {
          name: "characters",
          type: "[Character]!",
          description: "Characters that appeared in this episode.",
        },
      ],
    },
    Query: {
      kind: "OBJECT",
      name: "Query",
      fields: [
        {
          name: "character",
          type: "Character",
          description: "Get a specific character by ID",
          args: [
            {
              name: "id",
              type: "ID!",
              description: "ID of the character",
            },
          ],
        },
      ],
    },
  },
  _patterns: {
    connection: {
      fields: [
        { name: "info", type: "Info" },
        { name: "results", type: "[{item}]" },
      ],
    },
  },
  queryType: "Query",
};

describe("Schema Lookup", () => {
  describe("Schema Validation", () => {
    it("should validate a valid schema", () => {
      expect(() =>
        schemaLookup(testSchema, { lookup: "type", id: "Character" }),
      ).not.toThrow();
    });

    it("should reject an invalid schema", () => {
      const invalidSchema = {
        types: {
          Character: {
            // Missing required 'kind' field
            name: "Character",
            fields: [],
          },
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
      expect(result).toEqual(testSchema.types.Character);
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
      expect(result).toEqual({
        name: "status",
        type: "String",
        description:
          "The status of the character ('Alive', 'Dead' or 'unknown').",
      });
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

  describe("Relationships Lookup", () => {
    it("should find outgoing and incoming relationships", () => {
      const result = schemaLookup(testSchema, {
        lookup: "relationships",
        typeId: "Character",
      });
      expect(result).toEqual({
        outgoing: {
          episodes: "Episode",
        },
        incoming: {
          "Episode.characters": "Episode",
        },
      });
    });

    it("should return empty relationships for scalar types", () => {
      const schemaWithScalar = {
        types: {
          ...testSchema.types,
          DateTime: {
            kind: "SCALAR",
            name: "DateTime",
            description: "ISO-8601 encoded UTC date string",
          },
        },
      };
      const result = schemaLookup(schemaWithScalar, {
        lookup: "relationships",
        typeId: "DateTime",
      });
      expect(result).toEqual({
        outgoing: {},
        incoming: {},
      });
    });
  });

  describe("Search", () => {
    it("should find matching types and fields", () => {
      const result = schemaLookup(testSchema, {
        lookup: "search",
        query: "character",
        limit: 3,
      }) as SearchLookupResponse;
      expect(result.results).toHaveLength(3);
      expect(result.results[0].path).toBe("Character");
      expect(result.results[0].relevance).toBeGreaterThan(0);
    });

    it("should respect search limit", () => {
      const result = schemaLookup(testSchema, {
        lookup: "search",
        query: "character",
        limit: 1,
      }) as SearchLookupResponse;
      expect(result.results).toHaveLength(1);
    });

    it("should sort results by relevance", () => {
      const result = schemaLookup(testSchema, {
        lookup: "search",
        query: "character status",
        limit: 5,
      }) as SearchLookupResponse;
      expect(result.results[0].relevance).toBeGreaterThanOrEqual(
        result.results[1].relevance,
      );
    });
  });

  describe("Pattern Lookup", () => {
    it("should look up and apply a pattern", () => {
      const result = schemaLookup(testSchema, {
        lookup: "pattern",
        patternName: "connection",
        params: { item: "Character" },
      });
      expect(result).toEqual({
        kind: "OBJECT",
        fields: [
          { name: "info", type: "Info" },
          { name: "results", type: "[Character]" },
        ],
      });
    });

    it("should throw error for non-existent pattern", () => {
      expect(() =>
        schemaLookup(testSchema, {
          lookup: "pattern",
          patternName: "nonExistent",
          params: {},
        }),
      ).toThrow("Pattern not found: nonExistent");
    });
  });
});
