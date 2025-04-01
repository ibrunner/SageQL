import { describe, it, expect } from "@jest/globals";
import schemaCompressor from "../schema-compressor.js";

describe("Schema Compressor", () => {
  describe("Snapshots", () => {
    it("should match snapshot", () => {
      const schema = { types: { Character: mockCharacterType } };
      const compressed = schemaCompressor(schema);
      expect(compressed).toMatchSnapshot();
    });
  });

  describe("Step 1: Description Removal", () => {
    it("should keep all descriptions by default", () => {
      const schema = { types: { Character: mockCharacterType } };
      const compressed = schemaCompressor(schema);

      expect(compressed.types.Character.description).toBe(
        "A character from the Rick and Morty universe",
      );
      expect(compressed.types.Character.fields[0].description).toBe(
        "The id of the character.",
      );
    });

    it("should remove all descriptions when removeDescriptions is true and preserveEssentialDescriptions is false", () => {
      const schema = { types: { Character: mockCharacterType } };
      const compressed = schemaCompressor(schema, {
        removeDescriptions: true,
        preserveEssentialDescriptions: false,
      });

      expect(compressed.types.Character.description).toBeUndefined();
      expect(compressed.types.Character.fields[0].description).toBeUndefined();
    });

    it("should preserve only OBJECT descriptions when preserveEssentialDescriptions is true", () => {
      const schema = { types: { Character: mockCharacterType } };
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
      const schema = { types: { Character: typeWithoutDescription } };
      const compressed = schemaCompressor(schema);

      expect(compressed.types.Character.description).toBeUndefined();
      expect(compressed.types.Character.fields[0].description).toBeUndefined();
    });
  });

  describe("Step 2: Deprecation Pruning", () => {
    it("should remove deprecated fields when removeDeprecated is true", () => {
      const schema = { types: { User: mockDeprecatedFieldType } };
      const compressed = schemaCompressor(schema, { removeDeprecated: true });

      const fields = compressed.types.User.fields;
      expect(fields.length).toBe(1);
      expect(fields[0].name).toBe("id");
      expect(fields.find((f: any) => f.name === "username")).toBeUndefined();
    });

    it("should keep deprecated fields when removeDeprecated is false", () => {
      const schema = { types: { User: mockDeprecatedFieldType } };
      const compressed = schemaCompressor(schema, { removeDeprecated: false });

      const fields = compressed.types.User.fields;
      expect(fields.length).toBe(2);
      expect(fields.find((f: any) => f.name === "username")).toBeDefined();
    });
  });

  describe("Step 3: Empty/Null Field Pruning", () => {
    it("should remove empty arrays and null values", () => {
      const schema = { types: { Character: mockCharacterType } };
      const compressed = schemaCompressor(schema);

      expect(compressed.types.Character.inputFields).toBeUndefined();
      expect(compressed.types.Character.interfaces).toBeUndefined();
      expect(compressed.types.Character.enumValues).toBeUndefined();
      expect(compressed.types.Character.possibleTypes).toBeUndefined();
    });

    it("should remove empty args arrays from fields", () => {
      const schema = { types: { Character: mockCharacterType } };
      const compressed = schemaCompressor(schema);

      compressed.types.Character.fields.forEach((field: any) => {
        expect(field.args).toBeUndefined();
      });
    });
  });

  describe("Step 4: Type Reference Normalization", () => {
    it("should normalize complex nested type references into string notation", () => {
      const schema = { types: { Character: mockCharacterType } };
      const compressed = schemaCompressor(schema);

      const episodeField = compressed.types.Character.fields.find(
        (f: any) => f.name === "episode",
      );
      expect(episodeField.type).toBe("[Episode]!");
    });

    it("should handle simple scalar types", () => {
      const schema = { types: { Character: mockCharacterType } };
      const compressed = schemaCompressor(schema);

      const idField = compressed.types.Character.fields.find(
        (f: any) => f.name === "id",
      );
      expect(idField.type).toBe("ID");
    });
  });

  describe("Step 5: Directives Handling", () => {
    it("should compress directive definitions", () => {
      const schema = { types: { FieldWithDirectives: mockDirectiveType } };
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
  });

  // describe("Complete Schema Compression", () => {
  //   it("should produce a correctly compressed schema", () => {
  //     const schema = { types: { Character: mockCharacterType } };
  //     const compressed = schemaCompressor(schema);

  //     // Expected structure based on documentation example
  //     expect(compressed).toEqual({
  //       types: {
  //         Character: {
  //           kind: "OBJECT",
  //           name: "Character",
  //           description: "A character from the Rick and Morty universe",
  //           fields: [
  //             {
  //               name: "id",
  //               description: "The id of the character.",
  //               type: "ID",
  //             },
  //             {
  //               name: "name",
  //               description: "The name of the character.",
  //               type: "String",
  //             },
  //             {
  //               name: "episode",
  //               description: "Episodes in which this character appeared.",
  //               type: "[Episode]!",
  //             },
  //           ],
  //         },
  //       },
  //     });
  //   });
  // });
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
