# Knowledge Base Starter

Governed Sanity knowledge base feeding two AI surfaces from one dataset: an external help center (`app/`) and an internal staff tool (`dashboard/`), both querying Agent Context MCP. See `README.md` for the full picture.

## Quick start

pnpm install && pnpm run bootstrap && pnpm dev

## Monorepo

- Use `pnpm`, not `npm`
- Run commands from root via `pnpm --filter <pkg>`
- Each workspace has its own `.env` — no magic cascading from root

## Code style

- ESM-first (`"type": "module"`)
- No semicolons, single quotes, no bracket spacing
- Format with `oxfmt`, lint with `eslint`

## Stack

- Sanity Studio v5 (studio/)
- Next.js 16 + React 19 + Tailwind v4 — external help center (app/)
- Sanity App SDK — internal staff tool (dashboard/, added later)
- Sanity Functions (functions/)
