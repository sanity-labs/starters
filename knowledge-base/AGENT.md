# Knowledge Base Starter

Two Context MCP modes on one private dataset: GROQ for structured Beacon products/FAQs/policies, Knowledge Bases (beta) for grounded help articles and uploaded files. Help center + `/chat` (support) + `/internal` (ops). See `README.md` for the product-side Knowledge Base and MCP setup.

## Quick start

pnpm install && pnpm run bootstrap && pnpm dev

`bootstrap` prompts for an Anthropic key and a Context Viewer org token, adds a localhost CORS origin, deploys blueprint + schema, makes the dataset private, enables embeddings, mints a project Viewer token, regenerates and imports seed documents, and runs typegen. It does not create Knowledge Bases or MCP endpoints. `dev` runs studio (:3333), app (:3000), and functions.

## Workspaces

| Workspace            | What it is                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `studio/`            | Studio v5 — schema, Needs Review for policies, seed generator, uploadable files, bootstrap |
| `app/`               | Next.js help center, support chat, internal ops chat                                       |
| `functions/`         | `set-review-date` (stamps `reviewByDate` +90d on policies)                                 |
| `packages/@starter/` | Shared eslint-config, tsconfig, generated sanity-types                                     |

## Monorepo

- Use `pnpm`, not `npm`; run commands from this starter root via `pnpm --filter <pkg>`
- Each workspace has its own `.env` — no cascading from this starter root
- Shared dep versions live in the `catalog:` in pnpm-workspace.yaml
- `pretypecheck` runs typegen; queries are typed via `@starter/sanity-types`

## Architecture constraints

- Dataset is **private**. Help-center reads use `SANITY_API_READ_TOKEN` (project Viewer) on the server; `next-sanity` Live also uses it in the browser only while draft mode is on.
- Chat uses `SANITY_ORGANIZATION_TOKEN` (Context Viewer) and the `SANITY_MCP_*` URLs. Never send those to the browser. A surface runs with whichever of its GROQ / KB URLs is set.
- Product-side config (Knowledge Base purposes, source queries, MCP `groqFilter` and instructions) is checked in under `context/`. Edit there first, then paste into the Context app.
- Seed review dates are relative to generation time; `bootstrap` regenerates `studio/seed/data.ndjson` before importing.
- One source type per MCP. A dataset source wins and Knowledge Base sources are ignored.
- GROQ MCPs need `sanity schema deploy` (Studio 5.1.0+).
- Hybrid search: `text::semanticSimilarity()` only inside `score()`. Filter first.
- Policy `reviewByDate` is content governance. Knowledge Base freshness is refresh + Review in the Context app.
- Do not rebuild Issues, Instructions, citations, or Insights. The Context app owns those.
- Seeded contradiction: help article + FAQ = 30-day refunds; `studio/seed/files/customer/beacon-billing-refund-policy.pdf` = 45 days. The `.md` next to each PDF is the editable source; `pnpm --filter studio seed:files` re-renders the PDFs.
- No build-complete Function. Docs do not expose one.

## Code style

- ESM-first (`"type": "module"`), TypeScript strict
- No semicolons, single quotes, no bracket spacing
- Format with `oxfmt`, lint with `eslint`

## Gate before committing

pnpm run format:check && pnpm run lint && pnpm run typecheck && pnpm run validate
