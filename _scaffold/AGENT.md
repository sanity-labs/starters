# Starter Scaffold

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
- Next.js 16 + React 19 + Tailwind v4 (frontend/)
- Sanity Functions (functions/)
