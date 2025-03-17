# SageQL

A GraphQL AI Agent Framework for creating natural language interfaces to GraphQL APIs.

## Setup

1. Install dependencies:
```bash
yarn install
```

2. Copy the example environment file and update it with your configuration:
```bash
cp .env.example .env
```

3. Update the `.env` file with your GraphQL API configuration:
```env
GRAPHQL_API_URL=https://swapi-graphql.netlify.app/.netlify/functions/index
GRAPHQL_API_HEADERS={"Content-Type": "application/json"}
INTROSPECTION_OUTPUT_DIR=./src/graphql
```

## Development

### Fetching GraphQL Schema

To fetch the introspection schema from your GraphQL API:

```bash
yarn introspect
```

This will:
1. Connect to the configured GraphQL API
2. Execute the introspection query
3. Save the schema to `src/graphql/schema.json`

### Development Server

To start the development server:

```bash
yarn dev
```

## Project Structure

```
/
├── src/
│   ├── lib/
│   │   └── graphql/
│   │       └── client.ts    # GraphQL client utility
│   │   
│   ├── scripts/
│   │   └── introspect.ts    # Schema introspection script
│   └── graphql/             # Generated GraphQL schema
├── .env.example            # Example environment configuration
├── package.json           # Project dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

## License

MIT
