// Test schema based on Rick and Morty API
export const testSchema = {
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

// Full schema version (uncompressed)
export const fullCharacterSchema = {
  __schema: {
    types: [
      {
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
            name: "status",
            description:
              "The status of the character ('Alive', 'Dead' or 'unknown').",
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
            name: "episodes",
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
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        __typename: "__Type",
        kind: "OBJECT",
        name: "Episode",
        description: "A single episode of the series",
        fields: [
          {
            __typename: "__Field",
            name: "id",
            description: "The id of the episode.",
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
            description: "The name of the episode.",
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
            name: "characters",
            description: "Characters that appeared in this episode.",
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
                  name: "Character",
                  ofType: null,
                },
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        __typename: "__Type",
        kind: "OBJECT",
        name: "Query",
        fields: [
          {
            __typename: "__Field",
            name: "character",
            description: "Get a specific character by ID",
            args: [
              {
                __typename: "__InputValue",
                name: "id",
                description: "ID of the character",
                type: {
                  __typename: "__Type",
                  kind: "NON_NULL",
                  name: null,
                  ofType: {
                    __typename: "__Type",
                    kind: "SCALAR",
                    name: "ID",
                    ofType: null,
                  },
                },
                defaultValue: null,
              },
            ],
            type: {
              __typename: "__Type",
              kind: "OBJECT",
              name: "Character",
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
    ],
    queryType: {
      name: "Query",
    },
    mutationType: null,
    subscriptionType: null,
    directives: [],
  },
};

// Compressed schema version (for LLM context)
export const compressedCharacterSchema = {
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
  queryType: "Query",
};
