# Manual Setup

If you prefer to set things up step by step instead of running `pnpm bootstrap`, follow this guide.

All steps assume you have already scaffolded the project:

```bash
pnpm create sanity@latest --template sanity-labs/starters/ai-shopping-assistant --package-manager pnpm
cd your-project
```

The scaffold already created `app/.env.local` and `studio/.env` with your project ID, dataset, and API tokens.

## 1. Import sample data (recommended)

```bash
pnpm import-sample-data
```

This populates your Content Lake with products, categories, brands, an agent config, and an Agent Context document with slug `default`. If you skip this step, you'll need to create content and configure Agent Context manually (see step 5).

## 2. Set up environment variables

You need to add two values that the scaffold doesn't set:

1. **`ANTHROPIC_API_KEY`** — Add your key from [console.anthropic.com](https://console.anthropic.com) to both `app/.env.local` and `studio/.env`

2. **`SANITY_CONTEXT_MCP_URL`** — If you imported the sample data, the Agent Context slug is `default` and your MCP URL is:

   ```
   https://api.sanity.io/vX/agent-context/<your-project-id>/production/default
   ```

   Add this to `app/.env.local`. You can find your project ID in `studio/sanity.config.ts` or at [sanity.io/manage](https://sanity.io/manage).

## 3. Add CORS origin

Add `http://localhost:3000` so the frontend can talk to the Sanity API:

```bash
cd studio && npx sanity cors add http://localhost:3000
```

When prompted "Allow credentials to be sent from this origin?", answer **yes**.

## 4. Deploy the blueprint

The blueprint configures serverless functions used for auto-classifying chat conversations:

```bash
pnpm init:blueprints    # Select your project and create a stack
pnpm deploy:blueprints
```

Then set the Anthropic API key on the deployed function:

```bash
npx sanity functions env add agent-conversation ANTHROPIC_API_KEY your-key
```

## 5. Deploy the Studio

The Agent Context MCP endpoint requires a deployed Studio. Deploying just the schema is not sufficient.

```bash
cd studio && npx sanity deploy
```

Choose a hostname when prompted (e.g., `your-project-name`).

> **If you skipped sample data:** Open the Studio, go to **Agents > Agent Contexts**, create a document with a slug, configure the content filter, copy the MCP URL into `app/.env.local`, and publish the document.

## 6. Start development

```bash
pnpm dev
```

This starts both the Next.js app (http://localhost:3000) and the Studio (http://localhost:3333).
