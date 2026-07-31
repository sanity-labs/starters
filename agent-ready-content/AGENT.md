# Agent-ready content

Serve HTML to humans and markdown to agents from the same URLs. One Sanity dataset, two frontends (Next.js and Astro) implementing the same delivery pattern: explicit `.md` URLs, `Accept: text/markdown` negotiation, and discovery via `llms.txt` + `sitemap.md`.

## Quick start

pnpm install && pnpm run bootstrap && pnpm dev

## Monorepo

- Use `pnpm`, not `npm`
- Run commands from root via `pnpm --filter <pkg>`
- Each workspace has its own `.env` — no cascading from root. The root `.env` only feeds `scripts/bootstrap.mjs`, which writes the per-workspace env files.

## Layout

- `studio/` — Sanity Studio v6
- `apps/next/` — Next.js 16: HTML pages + `/md` route handlers + rewrites in `next.config.ts`
- `apps/astro/` — Astro 7: HTML pages + `.md` endpoints + `Accept` middleware (server output)
- `packages/schema/` — document types (section, article, code, callout)
- `packages/agent-markdown/` — Portable Text serializers, document builders, GROQ queries. Everything defining the markdown output lives here; the apps contribute routing only.
- `skills/agent-ready-content/` — skill for porting the pattern onto an existing project

## Code style

- ESM-first (`"type": "module"`)
- No semicolons, single quotes, no bracket spacing
- Format with `oxfmt`, lint with `eslint`

## Types

Queries use `defineQuery` and Sanity TypeGen with `overloadClientMethods`, so `client.fetch(QUERY)` is fully typed. After schema or query changes, run `pnpm typegen`. The generated `packages/agent-markdown/src/sanity.types.ts` and `studio/schema.json` are gitignored — `pretypecheck` regenerates them before `pnpm typecheck`.
