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

The template install script you ran to init this project set your Sanity related tokens in `studio/.env` and `app/.env.local`. You still need to add your Anthropic API key.

Add to `app/.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Also add `ANTHROPIC_API_KEY` to `studio/.env`.

## 3. Add CORS origin

```bash
cd studio && npx sanity cors add http://localhost:3000 --credentials
```

## 4. Deploy the Studio

```bash
cd studio && npx sanity deploy
```

Pick a hostname when prompted. The Agent Context MCP endpoint requires a deployed Studio.

> **Skipped sample data?** Open the Studio at your hostname, go to **Agents > Agent Contexts**, create and publish a document. If its slug is not `default`, set `SANITY_CONTEXT_SLUG` in `app/.env.local`.

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
