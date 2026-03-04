# Manual Setup

Step-by-step alternative to `pnpm bootstrap`. Run these after scaffolding:

```bash
pnpm create sanity@latest --template sanity-labs/starters/ai-shopping-assistant --package-manager pnpm
cd your-project
```

## 1. Import sample data

```bash
pnpm import-sample-data
```

Populates your Content Lake with products, categories, brands, and an Agent Context document (slug: `default`).

> Skip this step only if you plan to create content manually — you will need to configure Agent Context yourself in step 4.

## 2. Add environment variables

The scaffold sets your project ID, dataset, and API tokens. Add these two to `app/.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
SANITY_CONTEXT_MCP_URL=https://api.sanity.io/vX/agent-context/<your-project-id>/production/default
```

Replace `<your-project-id>` with the value from `studio/.env` or [sanity.io/manage](https://sanity.io/manage).

Also add `ANTHROPIC_API_KEY` to `studio/.env`.

## 3. Add CORS origin

```bash
cd studio && npx sanity cors add http://localhost:3000 --credentials
```

## 4. Deploy the Studio

```bash
cd studio && npx sanity deploy
```

Pick a hostname when prompted. The Agent Context MCP endpoint requires a deployed Studio — schema-only deploy is not enough.

> **Skipped sample data?** Open the Studio at your hostname, go to **Agents > Agent Contexts**, create and publish a document, then copy its MCP URL into `app/.env.local`.

## 5. Start development

```bash
pnpm dev
```

Opens the Next.js app at http://localhost:3000 and the Studio at http://localhost:3333.

---

## Optional: Deploy the blueprint

Enables the [Agent Insights](./README.md#agent-insights-studio-tool) dashboard — a Studio tool that auto-classifies chat conversations. Not required for the chatbot itself.

```bash
pnpm init:blueprints
pnpm deploy:blueprints
npx sanity functions env add agent-conversation ANTHROPIC_API_KEY <your-key>
```
