# Core Schema Creation: A Deterministic Approach

## Overview

This document outlines a deterministic process for creating a "core schema" - a minimal subset of a GraphQL schema that contains the most essential elements while providing sufficient breadcrumbs for additional lookups. This approach supports a tiered compression strategy where commonly used schema components are immediately available, and less common elements can be retrieved on demand.

## Core Schema Extraction Process

### Step 1: Query Type Analysis

Start with the Query type as the entry point to the schema.

1. Include the Query type with all its fields
2. For each field, include its return type signature (but not the full type definition)
3. Include argument definitions for these fields

Example:
```json
{
  "types": {
    "Query": {
      "kind": "OBJECT",
      "fields": [
        {
          "name": "character",
          "type": "Character",
          "args": [{"name": "id", "type": "ID!"}]
        },
        {
          "name": "characters",
          "type": "Characters",
          "args": [{"name": "page", "type": "Int"}, {"name": "filter", "type": "FilterCharacter"}]
        }
      ]
    }
  }
}
```

### Step 2: First-Level Type Expansion

Expand the immediate return types from query fields:

1. For each unique return type from Query fields, include the type definition
2. Include all fields for these types, but only type signatures for nested types
3. Include any enumerated types that are used in arguments or field definitions

Example:
```json
{
  "types": {
    "Query": { ... },
    "Character": {
      "kind": "OBJECT",
      "fields": [
        {"name": "id", "type": "ID"},
        {"name": "name", "type": "String"},
        {"name": "status", "type": "String"},
        {"name": "species", "type": "String"},
        {"name": "origin", "type": "Location"},
        {"name": "episode", "type": "[Episode]!"}
      ]
    },
    "Characters": {
      "kind": "OBJECT",
      "fields": [
        {"name": "info", "type": "Info"},
        {"name": "results", "type": "[Character]"}
      ]
    },
    "FilterCharacter": {
      "kind": "INPUT_OBJECT",
      "inputFields": [
        {"name": "name", "type": "String"},
        {"name": "status", "type": "String"},
        {"name": "species", "type": "String"}
      ]
    }
  }
}
```

### Step 3: Connection Relationship Analysis

Analyze the relationships between types to determine the most connected entities:

1. Build a relationship graph where nodes are types and edges are field relationships
2. Calculate "connection weight" for each type (how many other types reference it or it references)
3. Include types with connection weight above a threshold (e.g., top 30% most connected)

Example calculation:
```
Type: Character
  Referenced by: Query.character, Query.characters, Episode.characters
  References: Location, Episode
  Connection Weight: 5

Type: Location
  Referenced by: Character.origin, Character.location, Query.location
  References: Character
  Connection Weight: 4
```

### Step 4: Common Field Pattern Inclusion

Identify and include common field patterns:

1. Include "container" types that are used for pagination (e.g., Connection/Edge patterns)
2. Include info/metadata types that appear in multiple places
3. Include any interfaces that are implemented by multiple types

Example:
```json
{
  "types": {
    "Info": {
      "kind": "OBJECT",
      "fields": [
        {"name": "count", "type": "Int"},
        {"name": "pages", "type": "Int"},
        {"name": "next", "type": "Int"},
        {"name": "prev", "type": "Int"}
      ]
    }
  }
}
```

### Step 5: Enum and Scalar Type Inclusion

Always include all scalar and enum types in the core schema:

1. Scalar types are small and fundamental to the schema
2. Enum types provide valuable constraint information
3. These types rarely contribute significant size to the schema

Example:
```json
{
  "types": {
    "CacheControlScope": {
      "kind": "ENUM",
      "enumValues": [
        {"name": "PUBLIC"},
        {"name": "PRIVATE"}
      ]
    }
  }
}
```

### Step 6: Path Breadcrumb Creation

Create "breadcrumbs" for types not included in the core schema:

1. For each type not included in the core schema, create a path record
2. The path shows how to reach this type from a core type
3. Store minimal information about the excluded type

Example:
```json
{
  "paths": {
    "Episode": {
      "accessPath": ["Query.episode", "Character.episode"],
      "kind": "OBJECT", 
      "fieldCount": 6
    },
    "EpisodeConnection": {
      "accessPath": ["Character.episodes"],
      "kind": "OBJECT",
      "fieldCount": 2
    }
  }
}
```

## Type Inclusion Heuristics

The following deterministic rules can be used to decide which types to include in the core schema:

1. **Essential Types**:
   - Query type and direct return types
   - Mutation type (if present) and its input types
   - All scalar types
   - All enum types
   - All interface types

2. **Connection Weight Threshold**:
   - Types referenced by ≥ 3 other types
   - Types that reference ≥ 3 other types
   - Types that are both input and output types

3. **Size-Based Inclusion**:
   - Include small types (< 5 fields) even if less connected
   - Defer large types (> 20 fields) unless highly connected

4. **Usage Frequency** (if available from API analytics):
   - Types used in > 90% of queries
   - Fields accessed in > 50% of queries for their parent type

## Implementation

This algorithm can be implemented as a pre-processing step in the schema compression pipeline:

```javascript
function extractCoreSchema(schema) {
  const coreSchema = { types: {}, paths: {} };
  
  // Step 1: Add Query type
  const queryType = findQueryType(schema);
  coreSchema.types[queryType.name] = simplifyType(queryType, 1);
  
  // Step 2: Add first-level types
  const firstLevelTypes = getReturnTypesFromFields(queryType.fields);
  firstLevelTypes.forEach(type => {
    coreSchema.types[type.name] = simplifyType(type, 1);
  });
  
  // Step 3-6: Apply remaining rules
  const graph = buildTypeRelationshipGraph(schema);
  const weights = calculateConnectionWeights(graph);
  
  schema.types.forEach(type => {
    if (shouldIncludeInCore(type, weights)) {
      coreSchema.types[type.name] = simplifyType(type, 1);
    } else {
      coreSchema.paths[type.name] = createPathBreadcrumb(type, graph);
    }
  });
  
  return coreSchema;
}
```

## Lookup Integration

When using the core schema with a query generator:

1. Start with the core schema as the context
2. When encountering a type/field path not in core schema:
   - Use the path breadcrumbs to locate the type
   - Make a lookup request to retrieve the full definition
   - Add the retrieved type to the working context

Example workflow:
```
1. User query: "Get episodes where Rick appears with their air dates"
2. Core schema has Character but Episode is excluded
3. Find path to Episode: Character.episode
4. Use lookup: { "lookup": "type", "id": "Episode" }
5. Add Episode type to working context
6. Generate GraphQL query using Character and Episode
```

## Benefits

1. **Deterministic Process**: No reliance on machine learning or subjective criteria
2. **Adaptable Sizing**: Threshold parameters can be tuned based on context limits
3. **Path Preservation**: Ensures all types can be discovered through breadcrumbs
4. **Incremental Loading**: Supports progressive schema exploration

## Example Core Schema Size

For a typical GraphQL API with 50-100 types:
- Full schema: 10,000-20,000 tokens
- Core schema: 2,000-4,000 tokens (20% of full size)
- With aggressive thresholds: 1,000-2,000 tokens (10% of full size)

## Conclusion

This deterministic approach to core schema creation provides a balance between completeness and compactness. By focusing on the most connected and frequently used types while maintaining path breadcrumbs to all other types, it enables effective incremental schema loading while significantly reducing the initial context size.
