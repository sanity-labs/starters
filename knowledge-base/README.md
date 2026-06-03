# Knowledge Base

A governed, AI-queryable knowledge base powered by Sanity. Turn scattered support docs, wikis, and policies into a single source of truth that keeps customer-facing agents accurate and internal teams informed — from the same live dataset.

```sh
pnpm create sanity@latest --template sanity-labs/starters/knowledge-base
```

## What's inside

One Sanity dataset feeds two AI surfaces through two scoped [Agent Context](https://www.sanity.io/docs) (hosted MCP) configurations:

| Workspace               | What it is                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **`studio/`**           | Sanity Studio — content model, governance (Needs Review queue, review-clock Function), Agent Context configs, Content Health dashboard |
| **`app/`**              | External help center (Next.js) — public article browse, hybrid search, AI chat scoped to customer-facing content                       |
| **`dashboard/`**        | Internal staff tool (Sanity App SDK) — browse internal content + AI chat that sees both external and internal content                  |
| **`dashboard-server/`** | Chat proxy for the dashboard — holds the internal read token server-side (the App SDK app is browser-only)                             |
| **`functions/`**        | Sanity Functions — sets a 90-day review clock on publish                                                                               |

### Security model

- Dataset is **private** — no API access without a server-side token.
- The external surface uses a read token scoped (via its Agent Context GROQ filter) to external content types only.
- The internal surface uses a separate read token scoped to all types.
- **No token ever reaches the browser** on either surface.

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
├── skills/                # Claude Code skills for this starter
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
