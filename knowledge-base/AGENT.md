# Knowledge Base Starter

Governed Sanity knowledge base feeding two AI surfaces from one private dataset, each scoped by its own Agent Context (hosted MCP) config: an external help center (`app/`, slug `customer-support`) and an internal staff tool (`dashboard/` + `dashboard-server/`, slug `team-kb`). See `README.md` for the full picture and `skills/add-scoped-agent-surface/` for adding more surfaces.

## Quick start

pnpm install && pnpm run bootstrap && pnpm dev

`bootstrap` (studio/scripts/bootstrap.ts) deploys blueprint + schema + Studio, makes the dataset private, enables embeddings, mints tokens, writes env files, and imports seed data. `dev` runs studio (:3333), app (:3000), chat proxy (:8788), and functions.

## Workspaces

| Workspace            | What it is                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `studio/`            | Studio v5 — schema, Needs Review structure, Content Health plugin, seed generator, bootstrap |
| `app/`               | Next.js 16 external help center — browse, hybrid search, AI chat                             |
| `dashboard/`         | Sanity App SDK internal tool — browser-only SPA, auth = logged-in user                       |
| `dashboard-server/`  | Hono chat proxy — holds the internal token + Anthropic key for the dashboard                 |
| `functions/`         | `set-review-date` — stamps `reviewByDate` (+90d) on create/update                            |
| `packages/@starter/` | Shared eslint-config, tsconfig, generated sanity-types                                       |

## Monorepo

- Use `pnpm`, not `npm`; run commands from root via `pnpm --filter <pkg>`
- Each workspace has its own `.env` — no cascading from root
- Shared dep versions live in the `catalog:` in pnpm-workspace.yaml
- `pretypecheck` runs typegen; queries are typed via `@starter/sanity-types`

## Architecture constraints

- The dataset is **private**; read tokens live server-side only (Next API route, Hono proxy). Nothing secret in `NEXT_PUBLIC_*` / `SANITY_APP_*` vars — those are browser-bundled.
- The App SDK app (`dashboard/`) has no server, so its chat goes through `dashboard-server/`. Browsing there needs no token (logged-in user session).
- Agent Context MCP requires a **deployed Studio** — deployed schema alone returns `-32004`.
- Scoping is the `sanity.agentContext` document's `groqFilter`, not the token. New document types must be added to the filters and instructions (seeded from `studio/scripts/generate-seed.ts`).
- Hybrid search (`app/sanity/search.ts`): `text::semanticSimilarity()` only inside `score()`, needs Dataset Embeddings enabled, keyword `match` fallback on error.

## Code style

- ESM-first (`"type": "module"`), TypeScript strict
- No semicolons, single quotes, no bracket spacing
- Format with `oxfmt`, lint with `eslint`

## Gate before committing

pnpm run format:check && pnpm run lint && pnpm run typecheck && pnpm run validate
