# Spike to understand feasibly:

## Deliverables

- reusable AI prompt w/ introspection query
- AI tool to call graphql API with queries and return results
- generate queries dynamically
- conversation samples/examples using generated queries

## Development Steps

1. establish graphql connection with source that has introspection

- Select a source that has a public graphql API with introspection. For the purposes of a POC we should pick something simple like the spacex
- create config files for API connection config - env files, example env files, etc
- create script to retrieve introspection query including all info and types
- script should save query response to a file. this file will be read from the app, use a file format optimized for this
- add script to the scripts section in the package.json file so that it can be called from CLI

2. create a chat script that provides introspection query to context

- boilerplate for openAI api interaction
- use AI package from vercel
- create env files and example env files for storage of API keys, API url, model name
- create a simple system prompt that explains its purpose to talk to graphql apis using an introspection query
- create a few sample scripts that can ask generic questions about the api - what is it's purpose, what are it's main entities, generate a query that might be useful, etc
  - save these as files
- create a script that runs the basic scripts in the CLI
  - it should combine the system prompt with the introspection query that was generated in step 1
  - it should select a random sample prompt to run
  - it should show the user which prompt it's running
  - it should show the chat reponse to the prompt
  - add a verbose mode that logs the system prompt, sample prompt, and any other extra logging that would be useful for debugging

3. query generation tool

- create a tool that the AI script can call to process graphQL queries - actually hitting the api
- create an agent to generate queries based on unstructured requests, for now this should probably also include the full introspection query in the context
- allow an optional env field for the model to use for the query agent since this would be better for a coding/instruct model
- create a special system prompt telling the AI that it is a tool to generate graphql queries as part of the agent
- integrate the agent tool calling into our primary chat bot. evaluate sample scripts to include uses that would require tool calling, written generically enough to work for any api
- add logging in the console
- create file logging outputs for the query agent and query response tool, similar to those created by introspection, chat and preview scripts
- add a step to validate the query before it is returned or used by another agent, include retry logic if validation fails, this might require using apollo client or another tool to validate the syntax.
- since we now have tool calling and multiple agents, it might be a good time to introduce langgraph
- document the agent structure in the readme file, document any new scripts added to the package.json file, and create a mermaid chart showing the agent and tool orchestration
