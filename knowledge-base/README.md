# Knowledge Base

A governed, AI-queryable knowledge base powered by Sanity. Turn scattered support docs, wikis, and policies into a single source of truth that keeps customer-facing agents accurate and internal teams informed — from the same live dataset.

```sh
pnpm create sanity@latest --template sanity-labs/starters/knowledge-base
```

## What's inside

One Sanity dataset feeds two AI surfaces through two scoped [Agent Context](https://www.sanity.io/docs) (hosted MCP) configurations:

> The seed data ships with **Beacon**, a fictional customer-engagement SaaS — replace it with your own content. Everything Beacon-branded lives in `studio/scripts/generate-seed.ts`.

| Workspace               | What it is                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **`studio/`**           | Sanity Studio — content model, governance (Needs Review queue, review-clock Function), Agent Context configs, Content Health dashboard |
| **`app/`**              | External help center (Next.js) — public article browse, hybrid search, AI chat scoped to customer-facing content                       |
| **`dashboard/`**        | Internal staff tool (Sanity App SDK) — browse internal content + AI chat that sees both external and internal content                  |
| **`dashboard-server/`** | Chat proxy for the dashboard — holds the internal read token server-side (the App SDK app is browser-only)                             |
| **`functions/`**        | Sanity Functions — sets a 90-day review clock on publish, classifies chat conversations hourly                                         |

### Security model

- Dataset is **private** — no API access without a server-side token.
- The external surface uses a read token scoped (via its Agent Context GROQ filter) to external content types only.
- The internal surface uses a separate read token scoped to all types.
- **No token ever reaches the browser** on either surface.

### Agent Insights (opt-in)

Bootstrap asks whether to enable Agent Insights. When enabled, both chat surfaces save their conversations to the dataset (an Editor-role write token, minted by bootstrap, held server-side like the read tokens). A scheduled Function (`classify-conversations`) runs hourly and classifies them with Anthropic — success score, sentiment, content gaps — which populates the **Agent Insights** dashboard in the Studio.

Things to know:

- **Privacy**: conversation bodies — which may contain your users' questions — are stored in the dataset as `sanity.agentContextConversation` documents. `shareMetrics` sends classification metrics (never content) to Sanity; remove it in `functions/classify-conversations/index.ts` to opt out.
- **Cost**: classification calls Anthropic (claude-haiku-4-5) for each new conversation, once per hour. Tune the cron in `sanity.blueprint.ts` to your traffic.
- **Declining**: chat works normally, nothing is stored, and the deployed classifier function idles (it finds no conversations, so it makes no Anthropic calls). Enable later by re-running `pnpm bootstrap` and answering yes.

## Getting started

```sh
pnpm install
# Copy each .env.example to .env and fill in values
pnpm bootstrap   # deploy blueprint + schema, enable embeddings, seed data
pnpm dev
```

Studio runs at `http://localhost:3333`, the help center at `http://localhost:3000`.

## Project structure

```
knowledge-base/
├── studio/                # Sanity Studio v5 — schema, structure, plugins, seed
├── app/                   # Next.js external help center (Surface 1)
├── dashboard/             # Sanity App SDK internal tool (Surface 2)
├── dashboard-server/      # Chat proxy holding the internal token (App SDK is browser-only)
├── functions/             # Sanity Functions
├── packages/@starter/     # Shared eslint / tsconfig / generated types
├── sanity.blueprint.ts    # Function registrations
├── pnpm-workspace.yaml    # Workspaces + dependency catalog
└── package.json           # Root scripts
```

## Environment variables

Each workspace manages its own `.env` — no cascading from root. Copy each `.env.example` to `.env`. See each file for required values.

## Available scripts

| Command          | Description                                          |
| ---------------- | ---------------------------------------------------- |
| `pnpm dev`       | Start Studio, app, chat proxy, and functions         |
| `pnpm build`     | Build all workspaces                                 |
| `pnpm bootstrap` | Deploy blueprint + schema, generate types, seed data |
| `pnpm typegen`   | Regenerate Sanity TypeGen types                      |
| `pnpm typecheck` | Type-check all workspaces                            |
| `pnpm lint`      | Lint the entire project                              |
| `pnpm format`    | Format code with oxfmt                               |
| `pnpm validate`  | Validate the starter template structure              |
