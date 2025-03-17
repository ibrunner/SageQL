# SageQL

A tool for interacting with GraphQL APIs using natural language.

## Scripts

### Preview Chat Messages

Preview the messages that would be sent to the language model without making actual API calls:

```bash
yarn preview [options]
```

Options:

- `--list`: List all available prompts
- `--prompt=<name>`: Use a specific prompt by name
- `--verbose`: Show additional debug information
- `--log`: Save the preview output to a JSON file in `outputs/preview/`

### Chat with GraphQL API

Interact with the GraphQL API using natural language:

```bash
yarn chat [options]
```

Options:

- `--list`: List all available prompts
- `--prompt=<name>`: Use a specific prompt by name
- `--verbose`: Show additional debug information
- `--log`: Save the chat output to a JSON file in `outputs/chat/`

## Output Files

When using the `--log` flag, the following output files will be created:

### Preview Outputs

Located in `outputs/preview/`:

- Format: `preview-YYYY-MM-DDTHH-mm-ss-mmmZ.json`
- Contains: Messages that would be sent to the language model

### Chat Outputs

Located in `outputs/chat/`:

- Format: `chat-YYYY-MM-DDTHH-mm-ss-mmmZ.json`
- Contains: Messages sent to the language model and the response received

Each output file includes:

- Timestamp of the interaction
- Messages sent to the language model
- Response from the language model (for chat outputs only)
- Metadata about the model and API configuration used

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   yarn install
   ```
3. Copy the example environment file and fill in your OpenAI API key:
   ```bash
   cp .env.example .env
   ```
4. Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_key_here
   ```

## Usage

### Running the Chat Script

The chat script can be run in several ways:

1. Run with a random sample prompt:

   ```bash
   yarn chat
   ```

2. Run with verbose output:

   ```bash
   yarn chat --verbose
   ```

3. List available prompts:

   ```bash
   yarn chat --list
   ```

4. Run a specific prompt by name:
   ```bash
   yarn chat --prompt="Main Entities"
   ```

### Available Prompts

The script includes several pre-defined prompts for testing different aspects of the GraphQL API:

#### Schema Understanding

- Main Entities: Lists and describes the main entities in the API
- Type Structure: Shows available fields on the Character type
- Relationships: Explains how characters are related to other entities

#### Query Generation

- Character Query: Generates a query for Luke Skywalker's information
- Planet List: Creates a query for all planets
- Film Details: Generates a query for Episode IV details

## Development

### Project Structure

```
/
├── /src
│   ├── /graphql
│   │   └── schema.json        # GraphQL introspection schema
│   ├── /scripts
│   │   ├── /prompts          # Sample prompts for testing
│   │   ├── chat.ts          # Main chat script
│   │   └── introspect.ts    # Schema introspection script
│   └── /lib                 # Shared utilities
├── .env.example            # Example environment variables
└── package.json
```

### Adding New Prompts

To add new prompts, create a new file in `src/scripts/prompts/` and export an array of prompt objects with the following structure:

```typescript
{
  name: string; // Display name of the prompt
  prompt: string; // The actual prompt text
  expected: string; // Description of expected output
}
```

Then import and add the prompts to the `ALL_SAMPLE_PROMPTS` array in `chat.ts`.

## License

MIT
