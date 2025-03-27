# SageQL

A natural language to GraphQL query generator using LangChain and LangGraph.

## Features

- Natural language to GraphQL query generation
- Schema-aware query validation
- Automatic query execution
- Built-in error handling and retry logic
- Support for complex nested queries
- Integration with OpenAI's GPT models

## Project Structure

```
/
├── /src
│   ├── /agents
│   │   ├── /query-builder    # Query generation agent
│   │   └── graph.ts         # LangGraph orchestration
│   ├── /tools
│   │   ├── graphql-executor.ts  # GraphQL execution tool
│   │   └── query-validator.ts   # Query validation tool
│   ├── /scripts
│   │   ├── introspect.ts    # Schema introspection
│   │   ├── chat.ts         # Basic chat interface
│   │   ├── preview.ts      # Preview generated queries
│   │   └── query.ts        # Query generation script
│   └── /lib
│       └── /utils          # Utility functions
├── /outputs
│   └── schema.json         # Introspected GraphQL schema
└── package.json
```

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   yarn install
   ```
3. Copy `.env.example` to `.env` and fill in your environment variables:
   ```bash
   cp .env.example .env
   ```
4. Run the introspection script to fetch the GraphQL schema:
   ```bash
   yarn introspect
   ```

## Usage

### Query Generation

Generate and execute GraphQL queries from natural language:

```bash
yarn query "Show me all launches with their mission names and crew members"
```

The script will:

1. Generate a GraphQL query from your natural language request
2. Validate the query against the schema
3. Execute the query and return results

### Chat Interface

For interactive query generation:

```bash
yarn chat
```

### Preview Queries

Preview generated queries without executing them:

```bash
yarn preview "Show me all launches with their mission names and crew members"
```

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key
- `GRAPHQL_API_URL`: The URL of your GraphQL API
- `MODEL_NAME`: (Optional) The OpenAI model to use (defaults to gpt-4-turbo-preview)

## Development

### Adding New Features

1. Create new agents in `/src/agents`
2. Add new tools in `/src/tools`
3. Update the LangGraph orchestration in `graph.ts`
4. Add new scripts in `/src/scripts`

### Testing

```bash
yarn typecheck  # Type checking
yarn lint      # Linting
yarn format    # Code formatting
```

## Architecture

The system uses a LangGraph-based architecture with specialized agents:

1. **Query Builder Agent**: Generates GraphQL queries from natural language
2. **Query Validator**: Validates queries against the schema
3. **GraphQL Executor**: Executes validated queries

The workflow is orchestrated by a LangGraph that:

- Handles state management
- Implements retry logic for failed validations
- Manages the flow between agents
- Provides error handling and recovery

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT
