# Simplified Schema Compression System

## Overview

This document outlines a straightforward approach to GraphQL schema compression that can be quickly implemented and validated. Rather than relying on complex algorithms and data structures, this approach uses simple JSON representations and basic lookup functions to provide schema compression benefits with minimal development effort.

## Core Approach

The simplified approach focuses on three key components:

1. **Basic schema representation** as a JSON structure
2. **Simple compression techniques** that are easy to implement
3. **Lookup functions** for retrieving details when needed

## Phase 1: Basic Schema Representation

### Implementation Goals

- Parse GraphQL schema into a simplified JSON structure
- Focus only on essential elements (types, fields, relationships)
- Create a baseline for compression

### Example Schema Representation

```json
{
  "types": {
    "User": {
      "kind": "OBJECT",
      "fields": [
        { "name": "id", "type": "ID!" },
        { "name": "name", "type": "String" },
        { "name": "email", "type": "String" },
        { "name": "repositories", "type": "[Repository]" }
      ]
    },
    "Repository": {
      "kind": "OBJECT",
      "fields": [
        { "name": "id", "type": "ID!" },
        { "name": "name", "type": "String" },
        { "name": "owner", "type": "User" },
        { "name": "stars", "type": "Int" }
      ]
    },
    "Query": {
      "kind": "OBJECT",
      "fields": [
        {
          "name": "user",
          "type": "User",
          "args": [{ "name": "login", "type": "String!" }]
        },
        {
          "name": "repository",
          "type": "Repository",
          "args": [{ "name": "name", "type": "String!" }]
        }
      ]
    }
  },
  "relationships": {
    "User.repositories": "Repository",
    "Repository.owner": "User"
  }
}
```

### Testing Plan

- Parse 2-3 public GraphQL APIs (GitHub, SpaceX, etc.)
- Verify all essential schema elements are captured
- Benchmark parsing time and memory usage

## Phase 2: Simple Compression Techniques

### Implementation Goals

- Apply basic compression techniques that are quick to implement
- Achieve meaningful size reduction with minimal complexity
- Maintain ability to reconstruct original schema elements

### Compression Techniques

1. **Description Removal (Optional)**

   - Make description removal configurable to preserve schema intent
   - When enabled, remove all type and field descriptions
   - When disabled, retain descriptions to help LLMs understand schema intent

   Configuration option:

   ```json
   {
     "compression": {
       "removeDescriptions": false, // Set to true to remove descriptions
       "preserveEssentialDescriptions": true // Keep core type descriptions even when removing others
     }
   }
   ```

2. **Deprecation Pruning**

   - Remove deprecated fields
   - Store mapping of removed fields

3. **Empty/Null Field Pruning**

   - Remove fields with null values: `"inputFields": null`
   - Remove empty arrays: `"args": []`, `"interfaces": []`
   - Remove default boolean values: `"isDeprecated": false`
   - Remove redundant or predictable type information: `"__typename": "__Field"`

   Before:

   ```json
   {
     "__typename": "__Field",
     "name": "id",
     "description": "The id of the character.",
     "args": [],
     "type": {
       "__typename": "__Type",
       "kind": "SCALAR",
       "name": "ID",
       "ofType": null
     },
     "isDeprecated": false,
     "deprecationReason": null
   }
   ```

   After:

   ```json
   {
     "name": "id",
     "description": "The id of the character.",
     "type": "ID"
   }
   ```

4. **Type Reference Normalization**

   - Convert complex nested type references into simplified string notation
   - Use GraphQL SDL-style type references (e.g., `"[Episode]!"` instead of nested objects)
   - Create a mapping to restore full type information when needed

   Before:

   ```json
   {
     "__typename": "__Field",
     "name": "episode",
     "description": "Episodes in which this character appeared.",
     "type": {
       "__typename": "__Type",
       "kind": "NON_NULL",
       "name": null,
       "ofType": {
         "__typename": "__Type",
         "kind": "LIST",
         "name": null,
         "ofType": {
           "__typename": "__Type",
           "kind": "OBJECT",
           "name": "Episode",
           "ofType": null
         }
       }
     }
   }
   ```

   After:

   ```json
   {
     "name": "episode",
     "description": "Episodes in which this character appeared.",
     "type": "[Episode]!"
   }
   ```

   Type Reference Lookup:

   ```json
   // Request
   {
     "lookup": "typeStructure",
     "typeRef": "[Episode]!"
   }

   // Response
   {
     "kind": "NON_NULL",
     "ofType": {
       "kind": "LIST",
       "ofType": {
         "kind": "OBJECT",
         "name": "Episode"
       }
     }
   }
   ```

5. **Directives Handling**

   - Compress directive definitions
   - Store only actively used directives
   - Simplify directive locations and arguments

   Before:

   ```json
   {
     "__typename": "__Directive",
     "name": "deprecated",
     "description": "Marks an element of a GraphQL schema as no longer supported.",
     "locations": ["FIELD_DEFINITION", "ENUM_VALUE"],
     "args": [
       {
         "__typename": "__InputValue",
         "name": "reason",
         "description": "Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax.",
         "type": {
           "__typename": "__Type",
           "kind": "SCALAR",
           "name": "String",
           "ofType": null
         },
         "defaultValue": "\"No longer supported\""
       }
     ]
   }
   ```

   After:

   ```json
   {
     "name": "deprecated",
     "locations": ["FIELD_DEFINITION", "ENUM_VALUE"],
     "args": [
       {
         "name": "reason",
         "type": "String",
         "default": "\"No longer supported\""
       }
     ]
   }
   ```

6. **Common Pattern Recognition**

   - Identify and compress repetitive structural patterns
   - Predefine patterns for connection types, edge types, pagination, etc.
   - Apply pattern compression deterministically

   Before (Connection Pattern):

   ```json
   {
     "Characters": {
       "kind": "OBJECT",
       "fields": [
         {
           "name": "info",
           "type": {
             "kind": "OBJECT",
             "name": "Info"
           }
         },
         {
           "name": "results",
           "type": {
             "kind": "LIST",
             "ofType": {
               "kind": "OBJECT",
               "name": "Character"
             }
           }
         }
       ]
     },
     "Locations": {
       "kind": "OBJECT",
       "fields": [
         {
           "name": "info",
           "type": {
             "kind": "OBJECT",
             "name": "Info"
           }
         },
         {
           "name": "results",
           "type": {
             "kind": "LIST",
             "ofType": {
               "kind": "OBJECT",
               "name": "Location"
             }
           }
         }
       ]
     }
   }
   ```

   After (With Pattern Recognition):

   ```json
   {
     "_patterns": {
       "connection": {
         "fields": [
           { "name": "info", "type": "Info" },
           { "name": "results", "type": "[{item}]" }
         ]
       }
     },
     "Characters": {
       "kind": "OBJECT",
       "_patternRef": {
         "name": "connection",
         "params": { "item": "Character" }
       }
     },
     "Locations": {
       "kind": "OBJECT",
       "_patternRef": { "name": "connection", "params": { "item": "Location" } }
     }
   }
   ```

7. **Core Type Extraction**

   - See `simplified-core-schema-creation.md`
   - Identify essential types needed for most queries
   - Create a "core schema" with just these types

8. **Simple Type Grouping**

   - Group related types based on name prefixes or references
   - Create simple domain mappings

   Example:

   ```json
   {
     "domains": {
       "User": ["User", "UserStatus", "UserConnection"],
       "Repository": ["Repository", "RepositoryConnection", "RepositoryOwner"]
     }
   }
   ```

### Testing Plan

- Measure compression ratio (bytes before/after)
- Verify essential functionality is preserved
- Test with different compression level settings

## Phase 3: Lookup Functions

### Implementation Goals

- Create simple functions to look up schema elements by ID
- Enable retrieval of details not included in compressed schema
- Support dynamic reconstruction of schema elements

### Lookup API Examples

**Type Lookup:**

```json
// Request
{
  "lookup": "type",
  "id": "Repository"
}

// Response
{
  "kind": "OBJECT",
  "name": "Repository",
  "fields": [
    {"name": "id", "type": "ID!"},
    {"name": "name", "type": "String"},
    {"name": "owner", "type": "User"},
    {"name": "stars", "type": "Int"}
  ],
  "interfaces": ["Node"],
  "description": "A repository contains the content for a project."
}
```

**Field Lookup:**

```json
// Request
{
  "lookup": "field",
  "typeId": "Repository",
  "fieldId": "owner"
}

// Response
{
  "name": "owner",
  "type": "User",
  "description": "The User owner of the repository.",
  "args": []
}
```

**Relationship Lookup:**

```json
// Request
{
  "lookup": "relationships",
  "typeId": "User"
}

// Response
{
  "outgoing": {
    "repositories": "Repository"
  },
  "incoming": {
    "Repository.owner": "User"
  }
}
```

**Text-based Search:**

```json
// Request
{
  "lookup": "search",
  "query": "character status",
  "limit": 5
}

// Response
{
  "results": [
    {
      "path": "Character.status",
      "type": "String",
      "description": "The status of the character ('Alive', 'Dead' or 'unknown').",
      "relevance": 0.95
    },
    {
      "path": "FilterCharacter.status",
      "type": "String",
      "description": "Filter by character status",
      "relevance": 0.82
    },
    {
      "path": "Character",
      "kind": "OBJECT",
      "description": "A character from the Rick and Morty universe",
      "relevance": 0.75
    }
  ]
}
```

**Pattern Lookup:**

```json
// Request
{
  "lookup": "pattern",
  "patternName": "connection",
  "params": {
    "item": "Character"
  }
}

// Response
{
  "kind": "OBJECT",
  "fields": [
    {"name": "info", "type": "Info"},
    {"name": "results", "type": "[Character]"}
  ]
}
```

### Testing Plan

- Benchmark lookup performance for different schema sizes
- Test edge cases (missing elements, complex types)
- Verify accuracy of reconstructed schema elements

## Phase 4: Integration with Query Generator

### Implementation Goals

- Integrate compressed schema with query generator
- Enable on-demand schema element lookup
- Minimize context size while preserving functionality

### Integration Approach

1. **Context Initialization**

   - Provide compressed schema as initial context
   - Include core types and fields for common queries

2. **Dynamic Lookup**

   - Add lookup capability for retrieving additional schema elements
   - Use simple API calls to expand schema when needed

3. **Response Processing**
   - Parse lookup results back into usable schema form
   - Track which elements have been looked up

### Example Query Generation Flow

```
1. User asks: "Get repositories for user octocat with star counts"

2. Initialize context with compressed schema

3. Intent analysis identifies:
   - Need to query "user" with "login" argument
   - Need to access "repositories" field
   - Need "stargazerCount" field (not in core schema)

4. Look up missing field:
   lookupField("Repository", "stargazerCount")

5. Generate query with all required fields:
   query {
     user(login: "octocat") {
       repositories(first: 10) {
         nodes {
           name
           stargazerCount
         }
       }
     }
   }
```

### Testing Plan

- Generate queries with and without compression
- Compare context size requirements
- Verify query functionality is preserved
- Measure performance impact of lookups

## Implementation Roadmap

### Phase 1: Schema Representation & Parsing

- Create schema parser for GraphQL introspection results
- Build internal representation
- Test with multiple GraphQL APIs

### Phase 2: Basic Compression Implementation

- Implement configurable description removal
- Add deprecation pruning
- Add empty/null field pruning
- Implement type reference normalization
- Handle directive compression
- Add common pattern recognition
- Create core type extraction
- Develop simple domain grouping
- Build text-based search capabilities

### Phase 3: Lookup System & Testing

- Create lookup functions
- Implement caching for frequent lookups
- Test compressed schema with lookups
- Measure compression effectiveness

### Phase 4: Integration & Refinement

- Integrate with query generator
- Test end-to-end functionality
- Optimize based on results
- Document integration approach

## Benefits of Simplified Approach

1. **Quick Implementation**

   - Can be developed in 2-4 Phases
   - Minimal dependencies
   - Simple data structures

2. **Easy to Understand**

   - Straightforward JSON representation
   - Simple lookup mechanism
   - Clear compression techniques

3. **Testable**

   - Each phase produces usable results
   - Can measure compression benefits early
   - Incremental improvements

4. **Extensible**
   - Foundation for more advanced techniques
   - Can add optimizations incrementally
   - Modular design

## Example of Realistic Schema Compression

### Original Schema Snippet (Real-world example)

```json
{
  "__typename": "__Type",
  "kind": "OBJECT",
  "name": "Character",
  "description": "",
  "fields": [
    {
      "__typename": "__Field",
      "name": "id",
      "description": "The id of the character.",
      "args": [],
      "type": {
        "__typename": "__Type",
        "kind": "SCALAR",
        "name": "ID",
        "ofType": null
      },
      "isDeprecated": false,
      "deprecationReason": null
    },
    {
      "__typename": "__Field",
      "name": "name",
      "description": "The name of the character.",
      "args": [],
      "type": {
        "__typename": "__Type",
        "kind": "SCALAR",
        "name": "String",
        "ofType": null
      },
      "isDeprecated": false,
      "deprecationReason": null
    },
    {
      "__typename": "__Field",
      "name": "status",
      "description": "The status of the character ('Alive', 'Dead' or 'unknown').",
      "args": [],
      "type": {
        "__typename": "__Type",
        "kind": "SCALAR",
        "name": "String",
        "ofType": null
      },
      "isDeprecated": false,
      "deprecationReason": null
    },
    {
      "__typename": "__Field",
      "name": "species",
      "description": "The species of the character.",
      "args": [],
      "type": {
        "__typename": "__Type",
        "kind": "SCALAR",
        "name": "String",
        "ofType": null
      },
      "isDeprecated": false,
      "deprecationReason": null
    },
    {
      "__typename": "__Field",
      "name": "episode",
      "description": "Episodes in which this character appeared.",
      "args": [],
      "type": {
        "__typename": "__Type",
        "kind": "NON_NULL",
        "name": null,
        "ofType": {
          "__typename": "__Type",
          "kind": "LIST",
          "name": null,
          "ofType": {
            "__typename": "__Type",
            "kind": "OBJECT",
            "name": "Episode",
            "ofType": null
          }
        }
      },
      "isDeprecated": false,
      "deprecationReason": null
    }
  ],
  "inputFields": null,
  "interfaces": [],
  "enumValues": null,
  "possibleTypes": null
}
```

### Compressed Schema Representation

```json
{
  "kind": "OBJECT",
  "name": "Character",
  "fields": [
    {
      "name": "id",
      "description": "The id of the character.",
      "type": "ID"
    },
    {
      "name": "name",
      "description": "The name of the character.",
      "type": "String"
    },
    {
      "name": "status",
      "description": "The status of the character ('Alive', 'Dead' or 'unknown').",
      "type": "String"
    },
    {
      "name": "species",
      "description": "The species of the character.",
      "type": "String"
    },
    {
      "name": "episode",
      "description": "Episodes in which this character appeared.",
      "type": "[Episode]!"
    }
  ]
}
```

## Conclusion

This simplified approach to schema compression provides a quick way to validate the concept without investing in complex algorithms or data structures. By focusing on basic JSON representations and simple lookup functions, it enables meaningful compression benefits while remaining easy to implement and test.

The phased implementation plan allows for incremental development and testing, with each phase building on the previous one to deliver increasing value. This approach strikes a balance between simplicity and effectiveness, providing a solid foundation for more advanced compression techniques in the future if needed.
