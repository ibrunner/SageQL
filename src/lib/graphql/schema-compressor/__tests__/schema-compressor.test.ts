import { describe, it, expect } from "@jest/globals";
import schemaCompressor from "../schema-compressor.js";
import rickAndMortySchema from "./mocks/rick-and-morty-full-schema.js";

describe("Schema Compressor", () => {
  describe("Snapshots", () => {
    it("Mock Character Type should match snapshot", () => {
      const schema = {
        __schema: {
          queryType: {
            name: "Query",
          },
          types: [mockCharacterType],
          directives: mockDirectives,
        },
      };
      const compressed = schemaCompressor(schema);
      expect(compressed).toMatchSnapshot();
    });

    it("Rick and Morty Complete schema should match snapshot", () => {
      const compressed = schemaCompressor(rickAndMortySchema);
      expect(compressed).toMatchSnapshot();
    });
  });

  describe("Schema Structure", () => {
    it("should throw error if __schema property is missing", () => {
      const schema = { types: { Character: mockCharacterType } };
      expect(() => schemaCompressor(schema)).toThrow(
        "Invalid schema: missing __schema property",
      );
    });

    it("should include root operation types when present", () => {
      const schema = {
        __schema: {
          queryType: { name: "Query" },
          mutationType: { name: "Mutation" },
          subscriptionType: { name: "Subscription" },
          types: [mockCharacterType],
          directives: [],
        },
      };
      const compressed = schemaCompressor(schema);

      expect(compressed.queryType).toBe("Query");
      expect(compressed.mutationType).toBe("Mutation");
      expect(compressed.subscriptionType).toBe("Subscription");
    });

    it("should handle missing optional root types", () => {
      const schema = {
        __schema: {
          queryType: { name: "Query" },
          types: [mockCharacterType],
          directives: [],
        },
      };
      const compressed = schemaCompressor(schema);

      expect(compressed.queryType).toBe("Query");
      expect(compressed.mutationType).toBeUndefined();
      expect(compressed.subscriptionType).toBeUndefined();
    });
  });

  describe("Step 1: Description Removal", () => {
    it("should keep all descriptions by default", () => {
      const schema = {
        __schema: {
          queryType: { name: "Query" },
          types: [mockCharacterType],
          directives: mockDirectives,
        },
      };
      const compressed = schemaCompressor(schema);

      expect(compressed.types.Character.description).toBe(
        "A character from the Rick and Morty universe",
      );
      expect(compressed.types.Character.fields[0].description).toBe(
        "The id of the character.",
      );
      expect(compressed.directives[0].description).toBe(
        "Directs the executor to include this field or fragment only when the `if` argument is true",
      );
    });

    it("should remove all descriptions when removeDescriptions is true and preserveEssentialDescriptions is false", () => {
      const schema = {
        __schema: {
          queryType: { name: "Query" },
          types: [mockCharacterType],
          directives: mockDirectives,
        },
      };
      const compressed = schemaCompressor(schema, {
        removeDescriptions: true,
        preserveEssentialDescriptions: false,
      });

      expect(compressed.types.Character.description).toBeUndefined();
      expect(compressed.types.Character.fields[0].description).toBeUndefined();
      expect(compressed.directives[0].description).toBeUndefined();
    });

    it("should preserve only OBJECT descriptions when preserveEssentialDescriptions is true", () => {
      const schema = {
        __schema: {
          queryType: { name: "Query" },
          types: [mockCharacterType],
          directives: mockDirectives,
        },
      };
      const compressed = schemaCompressor(schema, {
        removeDescriptions: true,
        preserveEssentialDescriptions: true,
      });

      // OBJECT type description should be preserved
      expect(compressed.types.Character.description).toBe(
        "A character from the Rick and Morty universe",
      );
      // Field descriptions should still be removed
      expect(compressed.types.Character.fields[0].description).toBeUndefined();
      // Directive descriptions should be removed
      expect(compressed.directives[0].description).toBeUndefined();
    });

    it("should handle types without descriptions gracefully", () => {
      const typeWithoutDescription = {
        ...mockCharacterType,
        description: undefined,
        fields: mockCharacterType.fields.map((f) => ({
          ...f,
          description: undefined,
        })),
      };
      const schema = {
        __schema: {
          queryType: { name: "Query" },
          types: [typeWithoutDescription],
          directives: [],
        },
      };
      const compressed = schemaCompressor(schema);

      expect(compressed.types.Character.description).toBeUndefined();
      expect(compressed.types.Character.fields[0].description).toBeUndefined();
    });
  });

  describe("Step 2: Deprecation Pruning", () => {
    it("should remove deprecated fields when removeDeprecated is true", () => {
      const schema = {
        __schema: {
          queryType: { name: "Query" },
          types: [mockDeprecatedFieldType],
          directives: [],
        },
      };
      const compressed = schemaCompressor(schema, { removeDeprecated: true });

      const fields = compressed.types.User.fields;
      expect(fields.length).toBe(1);
      expect(fields[0].name).toBe("id");
      expect(fields.find((f: any) => f.name === "username")).toBeUndefined();
    });

    it("should keep deprecated fields when removeDeprecated is false", () => {
      const schema = {
        __schema: {
          queryType: { name: "Query" },
          types: [mockDeprecatedFieldType],
          directives: [],
        },
      };
      const compressed = schemaCompressor(schema, { removeDeprecated: false });

      const fields = compressed.types.User.fields;
      expect(fields.length).toBe(2);
      expect(fields.find((f: any) => f.name === "username")).toBeDefined();
    });
  });

  describe("Step 3: Empty/Null Field Pruning", () => {
    it("should remove empty arrays and null values", () => {
      const schema = {
        __schema: {
          queryType: { name: "Query" },
          types: [mockCharacterType],
          directives: [],
        },
      };
      const compressed = schemaCompressor(schema);

      expect(compressed.types.Character.inputFields).toBeUndefined();
      expect(compressed.types.Character.interfaces).toBeUndefined();
      expect(compressed.types.Character.enumValues).toBeUndefined();
      expect(compressed.types.Character.possibleTypes).toBeUndefined();
    });

    it("should remove empty args arrays from fields", () => {
      const schema = {
        __schema: {
          queryType: { name: "Query" },
          types: [mockCharacterType],
          directives: [],
        },
      };
      const compressed = schemaCompressor(schema);

      compressed.types.Character.fields.forEach((field: any) => {
        expect(field.args).toBeUndefined();
      });
    });
  });

  describe("Step 4: Type Reference Normalization", () => {
    it("should normalize complex nested type references into string notation", () => {
      const schema = {
        __schema: {
          queryType: { name: "Query" },
          types: [mockCharacterType],
          directives: [],
        },
      };
      const compressed = schemaCompressor(schema);

      const episodeField = compressed.types.Character.fields.find(
        (f: any) => f.name === "episode",
      );
      expect(episodeField.type).toBe("[Episode]!");
    });

    it("should handle simple scalar types", () => {
      const schema = {
        __schema: {
          queryType: { name: "Query" },
          types: [mockCharacterType],
          directives: [],
        },
      };
      const compressed = schemaCompressor(schema);

      const idField = compressed.types.Character.fields.find(
        (f: any) => f.name === "id",
      );
      expect(idField.type).toBe("ID");
    });
  });

  describe("Step 5: Directives Handling", () => {
    it("should compress directive definitions", () => {
      const schema = {
        __schema: {
          queryType: { name: "Query" },
          types: [mockDirectiveType],
          directives: mockDirectives,
        },
      };
      const compressed = schemaCompressor(schema);

      const statusField = compressed.types.FieldWithDirectives.fields[0];
      expect(statusField.directives).toBeDefined();
      expect(statusField.directives[0]).toEqual({
        name: "deprecated",
        args: [
          {
            name: "reason",
            type: "String",
            default: '"No longer supported"',
          },
        ],
      });
    });

    it("should handle schema-level directives", () => {
      const schema = {
        __schema: {
          queryType: { name: "Query" },
          types: [],
          directives: mockDirectives,
        },
      };
      const compressed = schemaCompressor(schema);

      expect(compressed.directives).toBeDefined();
      expect(compressed.directives.length).toBe(3);
      expect(compressed.directives[0]).toEqual({
        name: "include",
        description:
          "Directs the executor to include this field or fragment only when the `if` argument is true",
        args: [
          {
            name: "if",
            type: "Boolean!",
          },
        ],
        locations: ["FIELD", "FRAGMENT_SPREAD", "INLINE_FRAGMENT"],
      });
    });
  });
});

// Mock objects based on documentation examples
const mockCharacterType = {
  __typename: "__Type",
  kind: "OBJECT",
  name: "Character",
  description: "A character from the Rick and Morty universe",
  fields: [
    {
      __typename: "__Field",
      name: "id",
      description: "The id of the character.",
      args: [],
      type: {
        __typename: "__Type",
        kind: "SCALAR",
        name: "ID",
        ofType: null,
      },
      isDeprecated: false,
      deprecationReason: null,
    },
    {
      __typename: "__Field",
      name: "name",
      description: "The name of the character.",
      args: [],
      type: {
        __typename: "__Type",
        kind: "SCALAR",
        name: "String",
        ofType: null,
      },
      isDeprecated: false,
      deprecationReason: null,
    },
    {
      __typename: "__Field",
      name: "episode",
      description: "Episodes in which this character appeared.",
      args: [],
      type: {
        __typename: "__Type",
        kind: "NON_NULL",
        name: null,
        ofType: {
          __typename: "__Type",
          kind: "LIST",
          name: null,
          ofType: {
            __typename: "__Type",
            kind: "OBJECT",
            name: "Episode",
            ofType: null,
          },
        },
      },
      isDeprecated: false,
      deprecationReason: null,
    },
  ],
  inputFields: null,
  interfaces: [],
  enumValues: null,
  possibleTypes: null,
};

const mockDeprecatedFieldType = {
  __typename: "__Type",
  kind: "OBJECT",
  name: "User",
  description: "A user in the system",
  fields: [
    {
      __typename: "__Field",
      name: "id",
      type: {
        __typename: "__Type",
        kind: "SCALAR",
        name: "ID",
        ofType: null,
      },
      isDeprecated: false,
      deprecationReason: null,
    },
    {
      __typename: "__Field",
      name: "username",
      type: {
        __typename: "__Type",
        kind: "SCALAR",
        name: "String",
        ofType: null,
      },
      isDeprecated: true,
      deprecationReason: "Use 'name' instead",
    },
  ],
};

const mockDirectiveType = {
  __typename: "__Type",
  kind: "OBJECT",
  name: "FieldWithDirectives",
  fields: [
    {
      __typename: "__Field",
      name: "status",
      type: {
        __typename: "__Type",
        kind: "SCALAR",
        name: "String",
        ofType: null,
      },
      directives: [
        {
          name: "deprecated",
          args: [
            {
              name: "reason",
              type: {
                __typename: "__Type",
                kind: "SCALAR",
                name: "String",
                ofType: null,
              },
              defaultValue: '"No longer supported"',
            },
          ],
        },
      ],
    },
  ],
};

const mockDirectives = [
  {
    name: "include",
    description:
      "Directs the executor to include this field or fragment only when the `if` argument is true",
    locations: ["FIELD", "FRAGMENT_SPREAD", "INLINE_FRAGMENT"],
    args: [
      {
        name: "if",
        description: "Included when true.",
        type: {
          kind: "NON_NULL",
          name: null,
          ofType: {
            kind: "SCALAR",
            name: "Boolean",
            ofType: null,
          },
        },
        defaultValue: null,
      },
    ],
  },
  {
    name: "skip",
    description:
      "Directs the executor to skip this field or fragment when the `if`'argument is true.",
    locations: ["FIELD", "FRAGMENT_SPREAD", "INLINE_FRAGMENT"],
    args: [
      {
        name: "if",
        description: "Skipped when true.",
        type: {
          kind: "NON_NULL",
          name: null,
          ofType: {
            kind: "SCALAR",
            name: "Boolean",
            ofType: null,
          },
        },
        defaultValue: null,
      },
    ],
  },
  {
    name: "deprecated",
    description: "Marks the field or enum value as deprecated",
    locations: ["FIELD_DEFINITION", "ENUM_VALUE"],
    args: [
      {
        name: "reason",
        description: "The reason for the deprecation",
        type: {
          kind: "NON_NULL",
          name: null,
          ofType: {
            kind: "SCALAR",
            name: "String",
            ofType: null,
          },
        },
        defaultValue: '"No longer supported"',
      },
    ],
  },
];
