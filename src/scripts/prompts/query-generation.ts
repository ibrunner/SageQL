export const queryGenerationPrompts = [
  {
    name: "Basic Entity Query",
    prompt:
      "Generate a useful query to fetch information about a single entity from this API. Include related data that would be valuable to have.",
    expected:
      "A valid GraphQL query that fetches a single entity with relevant related data",
  },
  {
    name: "List Query",
    prompt:
      "Create a query to fetch a list of entities from this API. Include fields that would be useful for displaying in a table or list view.",
    expected:
      "A query that retrieves a list of entities with appropriate fields",
  },
  {
    name: "Complex Query",
    prompt:
      "Generate a more complex query that demonstrates the relationships between different entities in this API. Show how to fetch nested data across multiple levels.",
    expected:
      "A query that demonstrates complex relationships and nested data fetching",
  },
];
