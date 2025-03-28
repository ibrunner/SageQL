# Phase 2: Compression Engine

## Overview

This document outlines the implementation approach for the Compression Engine phase of the GraphQL Schema Compression System. This phase focuses on developing algorithms and techniques to reduce schema size while preserving essential functionality, laying the groundwork for efficient AI-powered query generation.

## Step 1: Field Pruning Engine

### Purpose

Reduce schema size by removing redundant field descriptions, normalizing field names, and pruning deprecated fields while maintaining essential functionality.

### Implementation Approach

1. Implement field description pruning with configurable verbosity levels
2. Develop field name normalization to reduce redundancy
3. Create detection and removal for deprecated fields
4. Build redundant field identification and consolidation
5. Generate field mapping records for the lookup system

Field pruning will specifically employ:

- Regular expression pattern matching for field name normalization
- Levenshtein distance and other string similarity metrics for identifying similar fields
- Word stemming and tokenization for semantic similarity detection
- Field usage pattern analysis to identify redundant fields
- Decision trees for configurable pruning logic based on field properties

### Field Pruning Configuration Options

```javascript
{
  "removeDescriptions": true,        // Remove field and type descriptions
  "shortenDescriptions": false,      // Alternative: truncate rather than remove
  "removeDeprecated": true,          // Remove deprecated fields
  "normalizeFieldNames": true,       // Standardize field naming patterns
  "pruneRedundantFields": true,      // Remove fields that duplicate functionality
  "compressionLevel": 2              // Overall compression aggressiveness (0-3)
}
```

### Field Pruning Output Example

```javascript
{
  "pruned": {
    "descriptions": 127,        // Number of descriptions removed
    "deprecated": 14,           // Number of deprecated fields removed
    "redundant": 23,            // Number of redundant fields consolidated
    "renamed": 42               // Number of fields with normalized names
  },
  "mappings": {
    "renamed": {
      "User.userEmail": "email",
      "User.userName": "name",
      "User.userAvatar": "avatar",
      "Repository.repositoryName": "name"
      // More renamed fields...
    },
    "removed": {
      "User": {
        "emailAddress": { "replacedBy": "email" },
        "mail": { "replacedBy": "email" },
        "fullName": { "replacedBy": "name" },
        "profilePicture": { "replacedBy": "avatar" }
        // More removed fields...
      },
      "Repository": {
        "repositoryFullName": { "replacedBy": "name" }
        // More removed fields...
      }
    }
  },
  "bytesReduced": 18540,        // Approximate size reduction
  "percentReduced": 12.4        // Percentage of schema size reduced
}
```

### Validation Criteria

- Preserves all essential fields while removing redundancy
- Creates accurate mappings for renamed and removed fields
- Maintains backward compatibility through mapping tables
- Configurable pruning levels based on requirements
- Verifies that field access through mappings returns correct data
- Measures size reduction accurately

### Testing Strategy

1. Test with different compression levels (0-3)
2. Verify mapping accuracy for renamed and removed fields
3. Test functionality preservation with sample queries
4. Measure size reduction across different schemas
5. Validate configuration option effects
6. Test with edge cases (empty descriptions, already optimized schemas)

## Step 2: Type Consolidation Engine

### Purpose

Reduce schema complexity by extracting common fields into interfaces and merging similar types to minimize redundancy.

### Implementation Approach

1. Implement algorithms to identify similar types based on field overlap
2. Create interface extraction for common fields
3. Build type merging functionality for highly similar types
4. Optimize enum types by combining similar values
5. Generate comprehensive mapping information for lookup service

Type consolidation will leverage:

- Field signature comparison algorithms to detect structural similarity
- Hierarchical clustering to identify groups of similar types
- Interface extraction based on common field pattern detection
- Jaccard similarity coefficient for measuring type overlap
- Tree-based algorithms for constructing optimal type hierarchies

### Type Consolidation Configuration Options

```javascript
{
  "interfaceThreshold": 0.7,      // Minimum similarity to extract interface (0-1)
  "mergeThreshold": 0.9,          // Minimum similarity to merge types (0-1)
  "removeExtractedFields": true,  // Remove fields from types after extraction to interface
  "removeSecondaryTypes": false,  // Remove secondary types after merging
  "optimizeEnums": true,          // Consolidate similar enum values
  "preserveTypeNames": true       // Keep original type names in descriptions
}
```

### Type Consolidation Output Example

```javascript
{
  "consolidated": {
    "interfaces": 3,              // New interfaces created
    "types": 7,                   // Types merged
    "enums": 2,                   // Enum types optimized
    "unions": 1                   // Union types optimized
  },
  "mappings": {
    "mergedTypes": {
      "AdminUser": {
        "mergedInto": "User",
        "originalFields": ["name", "email", "adminLevel", "permissions"]
      },
      "GuestUser": {
        "mergedInto": "User",
        "originalFields": ["name", "email", "sessionExpiry"]
      },
      "Product": {
        "mergedInto": "Item",
        "originalFields": ["id", "name", "price", "inventory"]
      },
      "Service": {
        "mergedInto": "Item",
        "originalFields": ["id", "name", "price", "duration"]
      }
      // More merged types...
    },
    "extractedInterfaces": {
      "UserInterface": {
        "implementingTypes": ["User", "AdminUser", "GuestUser"],
        "fields": ["name", "email", "id"]
      },
      "ItemInterface": {
        "implementingTypes": ["Item", "Product", "Service"],
        "fields": ["id", "name", "price"]
      },
      "NodeInterface": {
        "implementingTypes": ["User", "Item", "Repository"],
        "fields": ["id"]
      }
    },
    "optimizedEnums": {
      "UserRole": {
        "consolidated": ["ADMIN", "SUPER_ADMIN"],
        "replacement": "ADMIN"
      }
      // More optimized enums...
    }
  },
  "bytesReduced": 34220,
  "percentReduced": 22.7
}
```

### Schema Examples Before and After Type Consolidation

**Before:**

```graphql
type User {
  id: ID!
  name: String
  email: String
}

type AdminUser {
  id: ID!
  name: String
  email: String
  adminLevel: Int
  permissions: [String!]
}

type GuestUser {
  id: ID!
  name: String
  email: String
  sessionExpiry: String
}
```

**After:**

```graphql
interface UserInterface {
  id: ID!
  name: String
  email: String
}

type User implements UserInterface {
  id: ID!
  name: String
  email: String
  adminLevel: Int
  permissions: [String!]
  sessionExpiry: String
}
```

### Validation Criteria

- Identifies similar types based on configurable thresholds
- Creates interfaces that accurately represent common fields
- Maintains schema integrity when merging types
- Creates detailed mappings for merged types and extracted interfaces
- Verifies that GraphQL queries targeting consolidated types still work
- Measures size reduction accurately

### Testing Strategy

1. Test similar type detection with various similarity thresholds
2. Verify interface extraction with different type combinations
3. Test type merging with similar and dissimilar types
4. Validate query compatibility with consolidated schema
5. Test with complex type hierarchies (interfaces implementing other interfaces)
6. Measure size reduction across different schemas

## Step 3: Domain Extractor

### Purpose

Group related entity types into logical domains to support domain-specific schema views and progressive loading.

### Implementation Approach

1. Implement community detection algorithms to identify type clusters
2. Create domain boundary detection based on relationship analysis
3. Build domain-specific schema extraction
4. Generate cross-domain relationship mappings
5. Create domain metadata for AI agent consumption

Domain extraction will utilize:

- Louvain method for community detection in entity relationship graphs
- Modularity optimization to identify natural domain boundaries
- Force-directed graph layout algorithms to visualize domain clustering
- Betweenness centrality metrics to identify cross-domain interfaces
- Normalized mutual information for evaluating clustering quality

### Domain Configuration Options

```javascript
{
  "algorithm": "louvain",        // Community detection algorithm to use
  "minDomainSize": 2,            // Minimum number of entities in a domain
  "maxDomainSize": 20,           // Maximum number of entities in a domain
  "relationshipWeight": 0.7,     // Weight of relationships vs field similarity
  "includeDependencies": true,   // Include dependent types in domain
  "allowOverlap": false          // Allow types to appear in multiple domains
}
```

### Domain Extraction Output Example

```javascript
{
  "domains": [
    {
      "name": "UserManagement",
      "description": "Domain for user account and authentication related entities",
      "primaryEntityTypes": ["User", "Role", "Permission", "UserGroup"],
      "allTypes": ["User", "Role", "Permission", "UserGroup", "UserInput", "RoleInput", "AuthPayload", "UserStatus"],
      "endpoints": ["user", "users", "login", "logout", "register"],
      "metrics": {
        "entityCount": 4,
        "totalTypeCount": 8,
        "internalRelationships": 5,
        "externalRelationships": 3
      }
    },
    {
      "name": "ContentManagement",
      "description": "Domain for content creation and organization",
      "primaryEntityTypes": ["Post", "Comment", "Category", "Tag"],
      "allTypes": ["Post", "Comment", "Category", "Tag", "PostInput", "CommentInput", "PostStatus", "ContentStats"],
      "endpoints": ["post", "posts", "comments", "categories"],
      "metrics": {
        "entityCount": 4,
        "totalTypeCount": 8,
        "internalRelationships": 6,
        "externalRelationships": 2
      }
    },
    {
      "name": "Commerce",
      "description": "Domain for product and order management",
      "primaryEntityTypes": ["Product", "Order", "Customer", "Payment"],
      "allTypes": ["Product", "Order", "Customer", "Payment", "ProductInput", "OrderInput", "PaymentMethod", "OrderStatus"],
      "endpoints": ["products", "orders", "checkout", "payments"],
      "metrics": {
        "entityCount": 4,
        "totalTypeCount": 8,
        "internalRelationships": 5,
        "externalRelationships": 2
      }
    }
  ],
  "entityDomains": {
    "User": "UserManagement",
    "Role": "UserManagement",
    "Permission": "UserManagement",
    "UserGroup": "UserManagement",
    "Post": "ContentManagement",
    "Comment": "ContentManagement",
    "Category": "ContentManagement",
    "Tag": "ContentManagement",
    "Product": "Commerce",
    "Order": "Commerce",
    "Customer": "Commerce",
    "Payment": "Commerce"
  },
  "crossDomainRelationships": [
    {
      "sourceType": "Post",
      "sourceDomain": "ContentManagement",
      "targetType": "User",
      "targetDomain": "UserManagement",
      "relationshipFields": ["authorId", "author"]
    },
    {
      "sourceType": "Comment",
      "sourceDomain": "ContentManagement",
      "targetType": "User",
      "targetDomain": "UserManagement",
      "relationshipFields": ["userId", "user"]
    },
    {
      "sourceType": "Order",
      "sourceDomain": "Commerce",
      "targetType": "User",
      "targetDomain": "UserManagement",
      "relationshipFields": ["customerId", "customer"]
    }
  ],
  "domainSchemas": {
    "UserManagement": {
      // Extracted schema for UserManagement domain
    },
    "ContentManagement": {
      // Extracted schema for ContentManagement domain
    },
    "Commerce": {
      // Extracted schema for Commerce domain
    }
  }
}
```

### Domain Visualization Example

```
┌────────────────────────┐      ┌────────────────────────┐
│                        │      │                        │
│    UserManagement      │      │   ContentManagement    │
│                        │      │                        │
│  ┌─────┐     ┌─────┐  │      │  ┌─────┐     ┌─────┐   │
│  │User │     │Role │  │      │  │Post │     │Comment│  │
│  └──┬──┘     └─────┘  │      │  └──┬──┘     └──┬───┘  │
│     │                 │      │     │           │      │
│     │        ┌────────┼──────┼─────┘           │      │
│     │        │        │      │                 │      │
│     │        │        │      │  ┌────┐     ┌───┴──┐   │
│  ┌──┴────────┴──┐     │      │  │Tag │     │Category│  │
│  │ Permission   │     │      │  └────┘     └───────┘  │
│  └──────────────┘     │      │                        │
│                       │      │                        │
└───────────┬───────────┘      └────────────┬───────────┘
            │                                │
            │            ┌──────────────────┐│
            │            │                  ││
            └────────────┤     Commerce     ├┘
                         │                  │
                         │  ┌────┐  ┌─────┐ │
                         │  │Order│  │Product│
                         │  └──┬─┘  └───┬─┘ │
                         │     │        │   │
                         │     │    ┌───┴──┐│
                         │  ┌──┴───┐ │Payment││
                         │  │Customer└───────┘│
                         │  └──────┘         │
                         │                  │
                         └──────────────────┘
```

### Validation Criteria

- Correctly groups related entities into logical domains
- Identifies cross-domain relationships accurately
- Generates meaningful domain names and descriptions
- Creates valid sub-schemas for each domain
- Ensures that all dependent types are included in domain schemas
- Verifies that cross-domain references are preserved

### Testing Strategy

1. Test domain detection with various relationship structures
2. Verify logical grouping against expected domains
3. Test domain extraction with different algorithms
4. Validate cross-domain relationship detection
5. Verify completeness of domain-specific schemas
6. Test with complex schemas having many interconnected domains

## Step 4: Compressed Schema Generator

### Purpose

Combine all compression techniques into a cohesive pipeline that produces an optimized schema with configurably reduced size.

### Implementation Approach

1. Build a unified compression pipeline
2. Create multiple compression levels for different needs
3. Generate core compressed schema with essential elements
4. Produce domain-specific schema views
5. Calculate comprehensive compression statistics

### Compression Generator Configuration Options

```javascript
{
  "compressionLevel": 2,                // Overall compression level (0-3)
  "generateCoreSchema": true,          // Create a unified core schema
  "generateDomainSchemas": true,       // Create domain-specific schema views
  "includeStats": true,                // Include detailed compression stats
  "fieldOptions": {
    "removeDescriptions": true,
    "removeDeprecated": true,
    "normalizeNames": true
  },
  "typeOptions": {
    "interfaceThreshold": 0.7,
    "mergeThreshold": 0.85,
    "optimizeEnums": true
  },
  "domainOptions": {
    "algorithm": "louvain",
    "minDomainSize": 2,
    "includeDependencies": true
  }
}
```

### Compressed Schema Output Example

```javascript
{
  "core": {
    // Core compressed schema containing essential types
    "types": {
      "Query": { /* fields */ },
      "Mutation": { /* fields */ },
      "Node": { /* interface fields */ },
      "User": { /* primary fields */ },
      "Post": { /* primary fields */ }
      // Other essential types...
    },
    "queryType": "Query",
    "mutationType": "Mutation",
    "metadata": {
      "description": "Core compressed schema with essential types",
      "version": "1.0",
      "compressionLevel": 2
    }
  },
  "domains": {
    "UserManagement": {
      // Domain-specific schema
      "types": { /* User domain types */ },
      "queryType": "Query",
      "mutationType": "Mutation"
    },
    "ContentManagement": {
      // Domain-specific schema
      "types": { /* Content domain types */ },
      "queryType": "Query",
      "mutationType": "Mutation"
    },
    "Commerce": {
      // Domain-specific schema
      "types": { /* Commerce domain types */ },
      "queryType": "Query",
      "mutationType": "Mutation"
    }
  },
  "mappings": {
    "fields": {
      // Field mappings from field pruning
      "renamed": { /* Field name mappings */ },
      "removed": { /* Removed field mappings */ }
    },
    "types": {
      // Type mappings from type consolidation
      "mergedTypes": { /* Merged type mappings */ },
      "extractedInterfaces": { /* Interface mappings */ }
    },
    "domains": {
      // Domain mappings
      "entityDomains": { /* Entity to domain mappings */ },
      "crossDomainRelationships": [ /* Cross-domain relationships */ ]
    }
  },
  "compressionStats": {
    "originalSize": 154280,          // Bytes in original schema
    "coreSize": 28560,               // Bytes in core schema
    "domainSizes": {
      "UserManagement": 16420,
      "ContentManagement": 18950,
      "Commerce": 22180
    },
    "totalCompressedSize": 86110,    // Core + all domains
    "compressionRatio": 81.49,       // Core schema reduction (%)
    "totalCompressionRatio": 44.19,  // Overall reduction with domains (%)
    "typeReduction": {
      "original": 57,
      "compressed": 28,
      "reduction": 50.88
    },
    "fieldReduction": {
      "original": 342,
      "compressed": 156,
      "reduction": 54.39
    }
  }
}
```

### Validation Criteria

- Achieves target compression ratio (60-80% for core schema)
- Preserves all essential functionality
- Creates valid domain-specific schema views
- Generates complete mapping information for lookups
- Produces accurate compression statistics
- Maintains valid GraphQL SDL syntax for all outputs

### Testing Strategy

1. Test full compression pipeline with various schemas
2. Verify compression ratio targets are met
3. Validate functionality preservation with sample queries
4. Test with different compression level configurations
5. Verify all mappings are accurate and complete
6. Test the compressed schema with actual GraphQL execution

## Integration Tests

The following tests verify the end-to-end functionality of all Phase 2 components:

### Test 1: Complete Compression Pipeline

1. Start with a raw schema from GitHub GraphQL API
2. Run field pruning with different configurations
3. Apply type consolidation with various thresholds
4. Extract domains and generate domain-specific views
5. Create compressed schema with mappings
6. Verify compression ratio and functionality

### Test 2: Multi-Schema Compression Comparison

1. Compress schemas from 3+ different GraphQL APIs
2. Compare compression ratios and effectiveness
3. Identify patterns in compression opportunities
4. Test with different domain detection algorithms

### Test 3: Query Validation

1. Generate a set of sample queries against original schema
2. Verify these queries work against compressed schema
3. Test queries that span multiple domains
4. Measure query resolution time before and after compression

## Deliverables

Phase 2 will produce the following concrete deliverables:

1. **Field Pruning Engine**

   - Field description removal/truncation
   - Field name normalization
   - Redundant field detection and removal
   - Field mapping generation

2. **Type Consolidation Engine**

   - Similar type detection
   - Interface extraction
   - Type merging functionality
   - Mapping table generation

3. **Domain Extractor**

   - Community detection algorithm implementation
   - Domain boundary identification
   - Domain-specific schema extraction
   - Cross-domain relationship mapping

4. **Compressed Schema Generator**

   - Unified compression pipeline
   - Multi-level compression configurations
   - Core schema generator
   - Domain schema generator
   - Compression statistics calculator

5. **Documentation**
   - Compression algorithm documentation
   - Configuration options guide
   - Schema mapping format specification
   - Performance benchmarks
   - Test coverage report

## Success Metrics

The following metrics will determine the success of Phase 2:

1. **Compression Effectiveness**

   - Achieves 60-80% reduction in schema size for core schema
   - Maintains functionality equivalent to original schema
   - Creates logical domain groupings
   - Generates complete and accurate mapping information

2. **Performance**

   - Compresses a 1000-type schema in <30 seconds
   - Generates domain extractions in <10 seconds
   - Maintains reasonable memory usage during compression

3. **Usability**
   - Provides configurable compression levels
   - Creates valid GraphQL SDL output
   - Generates human-readable mapping information
   - Supports incremental compression updates
