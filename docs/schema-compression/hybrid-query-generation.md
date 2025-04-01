# Hybrid Query Generation System: LLM + Schema-Aware Query Builder

## Overview

This document outlines an approach that combines LLM-based intent understanding with a schema-aware query builder that leverages compression analysis for efficient and consistent GraphQL query generation. This approach is useful for building queries without an LLM dependency using only schema analysis, but also as an LLM tool to simplify query building and produce more consistent outputs.

## System Components

### 1. LLM Interface Layer

The LLM's role is simplified to:

- Understanding user intent
- Identifying primary entities and relationships
- Specifying essential fields
- Determining query context/domain

**Output Format Example:**

```json
{
  "primaryEntity": "User",
  "requiredFields": ["name", "email"],
  "relationships": [
    {
      "entity": "Repository",
      "fields": ["name", "description"],
      "type": "MANY"
    }
  ],
  "domain": "UserManagement",
  "intent": "fetch_user_with_repos"
}
```

### 2. Schema-Aware Query Builder

Leverages compression analysis to enhance basic queries:

#### Community Detection Enhancement

- Adds frequently co-occurring fields within the domain
- Includes standard relationships based on community analysis
- Applies domain-specific patterns and conventions

#### Weight-Based Field Selection

- Uses field frequency analysis to add commonly requested fields
- Incorporates fields with strong relationship weights
- Respects domain boundaries identified during compression

#### Pattern Application

- Applies validated query patterns from the domain
- Includes standard filtering and pagination where appropriate
- Adds type-specific fields based on schema analysis

**Example Enhancement Process:**

```json
{
  "original": {
    "entity": "User",
    "fields": ["name", "email"]
  },
  "enhanced": {
    "entity": "User",
    "fields": [
      "name",
      "email",
      "avatarUrl", // Added: High frequency in UserManagement domain
      "createdAt", // Added: Common timestamp pattern
      "status" // Added: Strong community relationship
    ],
    "includes": {
      "repositories": {
        "pagination": true, // Added: Standard pattern
        "fields": [
          "name",
          "description",
          "stargazerCount", // Added: High weight in relationship
          "updatedAt" // Added: Common timestamp pattern
        ]
      }
    }
  }
}
```

### 3. Query Generation Pipeline

1. **Intent Processing**

   - LLM processes user intent
   - Outputs compressed entity/field specification
   - Identifies relevant domains

2. **Query Enhancement**

   - Query builder receives LLM specification
   - Applies community-based enhancements
   - Adds weighted relationships
   - Incorporates domain patterns

3. **Validation & Feedback**
   - Validates generated query against schema
   - Records successful patterns
   - Updates relationship weights
   - Reinforces community detection

## Benefits

### Efficiency

- Reduced LLM token usage
- Faster query generation
- Pre-computed analysis utilization

### Consistency

- Standardized query patterns
- Domain-aware field selection
- Predictable structure

### Quality

- Community-validated field selection
- Weight-based relationship inclusion
- Self-improving pattern recognition

## Implementation Integration

### With Schema Compression System

- Uses domain extraction results
- Leverages relationship analysis
- Utilizes type consolidation information
- Incorporates field pruning intelligence

### With LLM System

- Simplified LLM prompts
- Focused intent mapping
- Reduced context requirements
- Clear interface contract

## Example Workflow

1. **User Request**

   ```text
   "Get user profile with their repositories"
   ```

2. **LLM Output**

   ```json
   {
     "primaryEntity": "User",
     "requiredFields": ["name"],
     "relationships": [
       {
         "entity": "Repository",
         "fields": ["name"]
       }
     ],
     "domain": "UserManagement"
   }
   ```

3. **Query Builder Enhancement**
   ```graphql
   query {
     user {
       name
       email # Added: High frequency field
       avatarUrl # Added: Community pattern
       createdAt # Added: Standard timestamp
       repositories(first: 10) {
         # Added: Pagination pattern
         nodes {
           name
           description # Added: Strong relationship
           stargazerCount # Added: Community pattern
           updatedAt # Added: Standard timestamp
         }
         pageInfo {
           # Added: Standard pagination
           hasNextPage
           endCursor
         }
       }
     }
   }
   ```

## Future Enhancements

### Pattern Learning

- Record successful query patterns
- Learn from user modifications
- Adapt to usage patterns
- Update community weights

### Context Awareness

- Consider request context
- Adapt to user preferences
- Support different detail levels
- Handle varying use cases

### Performance Optimization

- Cache common patterns
- Pre-compute enhancements
- Optimize validation checks
- Maintain weight updates

## Integration with Existing Systems

### Schema Registry

- Access compressed schemas
- Utilize domain mappings
- Reference relationship weights
- Track pattern success

### Validation Engine

- Verify enhanced queries
- Provide feedback
- Update statistics
- Maintain consistency

### Agent System

- Simplified agent prompts
- Focused responsibility
- Clear interface contracts
- Reduced context needs

## Conclusion

This hybrid approach combines the semantic understanding of LLMs with the structured knowledge embedded in schema compression analysis. By letting each component focus on its strengths, we create a more efficient and maintainable query generation system that improves over time through usage patterns and community detection.
