/**
 * Prompts for understanding the schema of the GraphQL API.
 * Consider these as meta-prompts for developers who are using the API and evaluating the framework.
 */
export const schemaUnderstandingPrompts = [
  {
    name: "Main Entities",
    prompt:
      "What are the main entities in this GraphQL API? Please list them and briefly describe their purpose and key characteristics.",
    expected:
      "A list of main entities with descriptions and key characteristics",
  },
  {
    name: "Type Structure",
    prompt:
      "Choose one of the main types from this API and describe its structure. What fields are available, what are their types, and what do they represent?",
    expected:
      "A detailed breakdown of a selected type's fields and their purposes",
  },
  {
    name: "Relationships",
    prompt:
      "How are the entities in this API related to each other? Describe the relationships and how they can be queried.",
    expected:
      "A description of relationships between entities and how to query them",
  },
];
