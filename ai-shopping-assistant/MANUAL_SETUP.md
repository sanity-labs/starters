# Manual Setup

This guide walks through each setup step individually. If you prefer an automated approach, run `pnpm bootstrap` instead (see [README.md](./README.md#quick-start)).

All steps below assume you have already scaffolded the project:

```bash
pnpm create sanity@latest --template sanity-labs/starters/ai-shopping-assistant --package-manager pnpm
cd your-project
```

## 1. Set up environment variables

The scaffold created `studio/.env` with your project ID and dataset. You need to propagate those values to the Next.js app and add a few more.

Copy the example env file to create `app/.env.local`:

```bash
cp app/.env.example app/.env.local
```

Open `app/.env.local` and fill in the values from `studio/.env`:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | `SANITY_STUDIO_PROJECT_ID` in `studio/.env` |
| `NEXT_PUBLIC_SANITY_DATASET` | `SANITY_STUDIO_DATASET` in `studio/.env` |
| `SANITY_API_READ_TOKEN` | Already set by the scaffold |
| `SANITY_API_WRITE_TOKEN` | Already set by the scaffold |

Add your **Anthropic API key** to both env files:

```bash
# In app/.env.local
ANTHROPIC_API_KEY=sk-ant-...

# In studio/.env
ANTHROPIC_API_KEY=sk-ant-...
```

Get a key at [console.anthropic.com](https://console.anthropic.com) if you don't have one.

## 2. Add CORS origin

Add `http://localhost:3000` to your project's allowed CORS origins so the frontend can talk to the Sanity API:

```bash
cd studio && npx sanity cors add http://localhost:3000
```

When prompted "Allow credentials to be sent from this origin?", answer **yes** -- this is required for authenticated API requests from the frontend.

You can check your existing origins at [sanity.io/manage](https://sanity.io/manage) > API > CORS Origins.

## 3. Initialize and deploy the blueprint

The blueprint configures serverless functions (used for auto-classifying chat conversations). Run from the project root:

```bash
pnpm init:blueprints
```

When prompted, select your Project ID and create or select a Stack.

Then deploy:

```bash
pnpm deploy:blueprints
```

## 4. Deploy the schema

Deploy your Studio schema to the Content Lake:

```bash
cd studio && npx sanity schema deploy
```

## 5. Import sample data

Import the included sample dataset with products, categories, brands, an agent config, and an Agent Context document:

```bash
pnpm import-sample-data
```

This creates an Agent Context document with the slug `default`. The MCP URL for this context is:

```
https://api.sanity.io/vX/agent-context/<your-project-id>/production/default
```

Add this URL to `app/.env.local`:

```bash
SANITY_CONTEXT_MCP_URL=https://api.sanity.io/vX/agent-context/<your-project-id>/production/default
```

Replace `<your-project-id>` with your actual project ID (found in `studio/.env` or at [sanity.io/manage](https://sanity.io/manage)).

> **If you skip sample data:** You will need to create an Agent Context document manually. Open the Studio, go to **Agents > Agent Contexts**, create a document with a slug, configure the content filter, and copy the MCP URL shown at the top of the document into your `app/.env.local`. The document must be published for the MCP endpoint to work.

## 6. Deploy the Studio

The Agent Context MCP endpoint requires a deployed Studio. Deploying just the schema is not sufficient.

```bash
cd studio && npx sanity deploy
```

Choose a hostname when prompted (e.g., `your-project-name`).

## 7. Set the function environment variable

The serverless function that classifies conversations needs the Anthropic API key:

```bash
npx sanity functions env add agent-conversation ANTHROPIC_API_KEY your-key
```

Replace `your-key` with your actual Anthropic API key.

## 8. Restore dependencies

Blueprint deployment can sometimes disrupt workspace `node_modules`. Run a clean install to make sure everything is in order:

```bash
pnpm install --force
```

## 9. Start development

```bash
pnpm dev
```

This starts both the Next.js app (http://localhost:3000) and the Studio (http://localhost:3333) in parallel. You can also run them individually with `pnpm dev:app` and `pnpm dev:studio`.
