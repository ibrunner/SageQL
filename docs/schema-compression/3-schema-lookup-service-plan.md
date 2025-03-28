# Phase 3: Schema Lookup Service

## Overview

This document outlines the implementation approach for the Schema Lookup Service phase of the GraphQL Schema Compression System. This phase focuses on enabling dynamic access to schema elements that weren't included in the compressed schema, ensuring all functionality remains available even with a significantly reduced schema size.

## Step 1: Schema Registry

### Purpose

Create a robust storage and indexing system for both compressed and full schemas, enabling efficient element retrieval and version management.

### Implementation Approach

1. Design a registry system that stores:
   - Full uncompressed schemas
   - Compressed schema variants
   - Transformation mappings
   - Version information
2. Implement efficient indexing for fast schema element lookup
3. Create version tracking for schema changes
4. Build APIs for schema registration and retrieval

### Schema Registry Structure

```javascript
{
  "registry": {
    "github-api-v4": {
      "versions": [
        {
          "id": "v4-2023-10-15",
          "timestamp": "2023-10-15T12:34:56Z",
          "fingerprint": "abc123def456",
          "stats": {
            "types": 148,
            "fields": 972,
            "size": 154280
          },
          "compressionVersions": [
            {
              "id": "v4-2023-10-15-c2",  // c2 = compression level 2
              "timestamp": "2023-10-15T13:45:12Z",
              "fingerprint": "789ghi101112",
              "compressionLevel": 2,
              "stats": {
                "coreSize": 28560,
                "totalCompressedSize": 86110,
                "compressionRatio": 44.19
              }
            }
          ]
        }
      ],
      "currentVersion": "v4-2023-10-15",
      "currentCompressedVersion": "v4-2023-10-15-c2"
    },
    "spacex-api": {
      // Similar structure for another API
    }
  },
  "indexes": {
    "github-api-v4-v4-2023-10-15": {
      "typeIndex": {
        // Lookup indexes for full schema
      },
      "fieldIndex": {
        // Lookup indexes for full schema
      }
    },
    "github-api-v4-v4-2023-10-15-c2": {
      "typeIndex": {
        // Lookup indexes for compressed schema
      },
      "fieldIndex": {
        // Lookup indexes for compressed schema
      },
      "mappingIndex": {
        // Indexes for mapping between compressed and full schema
      }
    }
  }
}
```

### Schema Registration API

```javascript
{
  "schemaId": "github-api-v4",
  "versionId": "v4-2023-10-15",
  "fullSchema": {
    // Complete schema definition
  },
  "compressedSchema": {
    "core": {
      // Core compressed schema
    },
    "domains": {
      // Domain-specific schemas
    },
    "mappings": {
      // Transformation mappings
    },
    "compressionStats": {
      // Compression statistics
    }
  },
  "options": {
    "createIndexes": true,
    "validateSchema": true,
    "setAsCurrent": true
  }
}
```

### Schema Retrieval API

```javascript
{
  "schemaId": "github-api-v4",
  "versionId": "v4-2023-10-15",       // Optional, defaults to current
  "compressionLevel": 2,              // Optional, 0 = full schema
  "format": "internal",               // Options: internal, sdl, json
  "includeStats": true,               // Include compression stats
  "includeMappings": true             // Include transformation mappings
}
```

### Validation Criteria

- Efficiently stores and retrieves both full and compressed schemas
- Maintains version history for schema changes
- Creates effective indexes for fast element lookup
- Supports multiple compression levels for the same base schema
- Handles large schemas without performance issues
- Provides clear APIs for schema registration and retrieval

### Testing Strategy

1. Test schema storage with multiple versions of the same API
2. Verify retrieval performance for large schemas
3. Test index effectiveness for element lookup
4. Validate version management functionality
5. Test schema format conversions (internal, SDL, JSON)
6. Benchmark storage and retrieval operations

## Step 2: Lookup Service

### Purpose

Provide efficient access to schema elements that aren't included in the compressed schema, enabling full functionality with minimal context size.

### Implementation Approach

1. Implement lookup APIs for schema elements:
   - Type lookups for missing types
   - Field lookups for pruned fields
   - Argument lookups for simplified operations
2. Create caching mechanisms for frequently accessed elements
3. Build mapping resolution between compressed and full schema
4. Develop context tracking for progressive schema loading

The lookup service implementation will use:

- Trie data structures for efficient prefix-based lookup
- Hash-based indexes for constant-time element retrieval
- LRU caching algorithm for frequently accessed elements
- Bloom filters for efficient set membership testing
- B-tree indexes for range-based queries on schema elements

### Lookup Service API Structure

```javascript
{
  "lookup": {
    "type": {
      "name": "GithubRepositoryOwner",    // Type name to look up
      "context": "repository owner info", // Optional context for lookup
      "schemaId": "github-api-v4",        // Schema identifier
      "versionId": "v4-2023-10-15-c2"     // Schema version
    },
    "field": {
      "name": "avatarUrl",                // Field name to look up
      "parentType": "User",               // Parent type name
      "includeArgs": true,                // Include argument definitions
      "context": "user profile picture",  // Optional context for lookup
      "schemaId": "github-api-v4",
      "versionId": "v4-2023-10-15-c2"
    },
    "interface": {
      "name": "Node",                     // Interface name to look up
      "includeImplementors": true,        // Include implementing types
      "schemaId": "github-api-v4",
      "versionId": "v4-2023-10-15-c2"
    }
  }
}
```

### Lookup Result Examples

**Type Lookup**

```javascript
{
  "found": true,
  "element": {
    "kind": "INTERFACE",
    "name": "RepositoryOwner",
    "description": "Represents an owner of a Repository.",
    "fields": [
      {
        "name": "avatarUrl",
        "type": { "kind": "SCALAR", "name": "URL" },
        "args": [
          {
            "name": "size",
            "type": { "kind": "SCALAR", "name": "Int" },
            "defaultValue": 400
          }
        ]
      },
      {
        "name": "id",
        "type": {
          "kind": "NON_NULL",
          "ofType": { "kind": "SCALAR", "name": "ID" }
        }
      },
      // More fields...
    ],
    "interfaces": [],
    "possibleTypes": ["User", "Organization"]
  },
  "compressionInfo": {
    "reason": "Not in core schema",
    "domain": "UserManagement",
    "mappingPath": "interfaces.RepositoryOwner"
  },
  "cacheInfo": {
    "cached": false,
    "ttl": 3600
  }
}
```

**Field Lookup**

```javascript
{
  "found": true,
  "element": {
    "name": "avatarUrl",
    "description": "A URL pointing to the owner's public avatar.",
    "type": { "kind": "SCALAR", "name": "URL" },
    "args": [
      {
        "name": "size",
        "type": { "kind": "SCALAR", "name": "Int" },
        "defaultValue": 400
      }
    ],
    "isDeprecated": false
  },
  "compressionInfo": {
    "reason": "Removed during field pruning",
    "replacedBy": "avatar",
    "mappingPath": "fields.renamed.User.avatarUrl"
  },
  "cacheInfo": {
    "cached": true,
    "ttl": 3600
  }
}
```

### Lookup Service Cache Structure

```javascript
{
  "cacheConfig": {
    "maxSize": 1000,           // Maximum number of cached elements
    "defaultTTL": 3600,        // Default time-to-live in seconds
    "priorityTypes": {
      "INTERFACE": 0.8,        // Higher priority = less likely to be evicted
      "OBJECT": 0.7,
      "FIELD": 0.5,
      "ENUM": 0.3,
      "SCALAR": 0.2
    }
  },
  "stats": {
    "hits": 1428,              // Cache hit count
    "misses": 347,             // Cache miss count
    "hitRate": 0.805,          // Hit rate
    "size": 782,               // Current number of cached elements
    "evictions": 218           // Number of elements evicted from cache
  },
  "elements": {
    // Cached elements (implementation-dependent)
  }
}
```

### Validation Criteria

- Accurately retrieves schema elements from full schema
- Successfully resolves mappings between compressed and full schemas
- Provides fast lookups (<100ms for non-cached elements)
- Implements effective caching for frequently accessed elements
- Handles edge cases (missing elements, schema changes)
- Manages cache size and eviction policies

### Testing Strategy

1. Test lookups for various element types (types, fields, interfaces, etc.)
2. Verify mapping resolution for renamed and removed elements
3. Test cache effectiveness with repeated lookups
4. Benchmark lookup performance for cached and non-cached elements
5. Validate edge case handling (missing elements, version mismatches)
6. Test with multiple schema versions

## Step 3: Context-Aware Schema Provider

### Purpose

Provide schema information tailored to specific contexts, enabling progressive loading of schema details based on current needs.

### Implementation Approach

1. Implement context-based schema loading:
   - Core schema always available
   - Domain-specific schemas loaded on demand
   - Individual elements retrieved as needed
2. Create domain detection from query context
3. Develop progressive expansion mechanisms
4. Build context tracking for evolving schema needs

### Context Provider API

```javascript
{
  "getSchemaContext": {
    "schemaId": "github-api-v4",
    "versionId": "v4-2023-10-15-c2",
    "initialContext": {
      "intent": "Retrieve user repositories with star counts",
      "entities": ["User", "Repository"],
      "operations": ["query"],
      "fields": ["repositories", "stargazerCount"]
    },
    "options": {
      "includeCore": true,
      "maxDomains": 2,
      "expandFields": true
    }
  }
}
```

### Context Provider Results

```javascript
{
  "context": {
    "schemaId": "github-api-v4",
    "versionId": "v4-2023-10-15-c2",
    "core": {
      // Core schema elements
    },
    "domains": {
      "UserManagement": {
        // User domain schema elements
      },
      "RepositoryManagement": {
        // Repository domain schema elements
      }
    },
    "expandedElements": [
      {
        "kind": "FIELD",
        "name": "stargazerCount",
        "parentType": "Repository",
        // Field details...
      }
    ],
    "contextSize": 24680, // Bytes of schema context provided
    "fullSize": 154280,   // Full schema size for comparison
    "reductionRatio": 84.0 // Percentage reduction
  }
}
```

### Context Update API

```javascript
{
  "updateSchemaContext": {
    "contextId": "ctx-123456",
    "addElements": {
      "types": ["PullRequest", "Issue"],
      "fields": [
        {"parentType": "Repository", "name": "pullRequests"},
        {"parentType": "Repository", "name": "issues"}
      ]
    },
    "addDomains": ["IssueTracking"],
    "options": {
      "expandFields": true
    }
  }
}
```

### Validation Criteria

- Correctly identifies required schema elements from context
- Loads appropriate domains based on entity needs
- Progressively expands schema as context evolves
- Maintains efficient context size (60-80% smaller than full schema)
- Provides adequate schema information for query generation
- Handles complex, multi-domain contexts effectively

### Testing Strategy

1. Test context generation with various intents
2. Verify domain loading based on entity references
3. Test progressive context expansion
4. Measure context size compared to full schema
5. Validate query generation with context-limited schema
6. Test with complex, evolving contexts

## Step 4: Schema Validation System

### Purpose

Ensure that queries generated using the compressed schema remain valid against the full schema, providing confidence in the integrity of generated queries.

### Implementation Approach

1. Implement validation of GraphQL queries:
   - Syntax validation
   - Schema compatibility checking
   - Field and argument validation
2. Create error detection and reporting
3. Build validation against full and compressed schemas
4. Develop suggestions for query corrections

### Query Validation API

```javascript
{
  "validateQuery": {
    "query": "query GetUserRepositories($login: String!) { user(login: $login) { repositories(first: 10) { nodes { name stargazerCount } } } }",
    "variables": {
      "login": "octocat"
    },
    "schemaId": "github-api-v4",
    "versionId": "v4-2023-10-15-c2",
    "options": {
      "validateAgainstFull": true,
      "suggestFixes": true,
      "checkDeprecations": true
    }
  }
}
```

### Validation Results

```javascript
{
  "valid": true,
  "compressedSchemaValid": true,
  "fullSchemaValid": true,
  "errors": [],
  "warnings": [
    {
      "message": "Field 'stargazerCount' is not in compressed schema but is valid in full schema",
      "path": ["user", "repositories", "nodes", "stargazerCount"],
      "locations": [{ "line": 1, "column": 73 }],
      "expansionInfo": {
        "field": "stargazerCount",
        "parentType": "Repository",
        "domain": "RepositoryMetrics"
      }
    }
  ],
  "expansions": [
    {
      "kind": "FIELD",
      "name": "stargazerCount",
      "parentType": "Repository",
      "domain": "RepositoryMetrics"
    }
  ],
  "deprecations": [],
  "suggestions": []
}
```

### Error Validation Example

```javascript
{
  "valid": false,
  "compressedSchemaValid": false,
  "fullSchemaValid": false,
  "errors": [
    {
      "message": "Cannot query field 'star_count' on type 'Repository'",
      "path": ["user", "repositories", "nodes", "star_count"],
      "locations": [{ "line": 1, "column": 73 }],
      "extensions": {
        "code": "FIELD_NOT_FOUND",
        "fieldName": "star_count",
        "parentType": "Repository"
      }
    }
  ],
  "suggestions": [
    {
      "message": "Did you mean 'stargazerCount'?",
      "fixedQuery": "query GetUserRepositories($login: String!) { user(login: $login) { repositories(first: 10) { nodes { name stargazerCount } } } }",
      "confidence": 0.95
    }
  ]
}
```

### Validation Criteria

- Correctly validates queries against both compressed and full schemas
- Identifies fields and types not in compressed schema
- Provides accurate error messages for invalid queries
- Suggests fixes for common query errors
- Detects use of deprecated fields and types
- Identifies required schema expansions for query execution

### Testing Strategy

1. Test validation with valid and invalid queries
2. Verify error detection and message clarity
3. Test with queries requiring schema expansion
4. Validate error suggestions accuracy
5. Test with complex queries spanning multiple domains
6. Verify validation performance with large queries

## Integration Tests

The following tests verify the end-to-end functionality of all Phase 3 components:

### Test 1: Complete Lookup Pipeline

1. Register a compressed schema in the registry
2. Perform lookups for various element types
3. Test cache effectiveness with repeated lookups
4. Validate query against compressed and full schemas
5. Verify context generation and expansion

### Test 2: Multi-Schema Lookup Comparison

1. Register multiple schemas in the registry
2. Compare lookup performance across schemas
3. Test validation across different schema versions
4. Verify cache effectiveness with different schemas

### Test 3: Progressive Schema Loading

1. Start with core schema only
2. Gradually expand context with additional domains
3. Track context size growth with each expansion
4. Verify query validation at each expansion stage

## Deliverables

Phase 3 will produce the following concrete deliverables:

1. **Schema Registry**

   - Storage for full and compressed schemas
   - Version tracking system
   - Indexing for efficient lookup
   - Schema registration and retrieval APIs

2. **Lookup Service**

   - Element lookup APIs
   - Mapping resolution system
   - Caching mechanism
   - Performance metrics

3. **Context-Aware Schema Provider**

   - Context-based schema loading
   - Domain detection system
   - Progressive expansion mechanism
   - Context tracking

4. **Schema Validation System**

   - Query validation against full and compressed schemas
   - Error detection and reporting
   - Query correction suggestions
   - Validation metrics

5. **Documentation**
   - API documentation for all services
   - Schema context format specification
   - Performance benchmarks
   - Service integration guide

## Success Metrics

The following metrics will determine the success of Phase 3:

1. **Lookup Performance**

   - Sub-100ms lookup times for non-cached elements
   - Sub-10ms lookup times for cached elements
   - > 80% cache hit rate after warm-up
   - Linear scaling with schema size

2. **Schema Context Efficiency**

   - 60-80% context size reduction compared to full schema
   - Accurate domain inclusion based on query needs
   - Progressive expansion without duplicating elements
   - Minimal context overhead

3. **Validation Accuracy**

   - Correctly validates >99% of queries
   - Provides actionable error messages
   - Suggests accurate fixes for common errors
   - Fast validation performance

4. **Registry Efficiency**
   - Efficient storage of multiple schema versions
   - Fast schema retrieval
   - Effective indexing for element lookup
   - Reliable version tracking
