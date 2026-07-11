# Angular Blog Starter

## Quick start

```bash
pnpm install && pnpm bootstrap && pnpm dev
```

## Monorepo

- Use `pnpm`, not `npm`
- Run commands from root via `pnpm --filter <pkg>`
- Root `.env.local` is loaded by Studio CLI and the Angular SSR server

## Code style

- ESM-first (`"type": "module"`)
- No semicolons, single quotes, no bracket spacing
- Format with `oxfmt`, lint with `eslint`

## Stack

- Sanity Studio v6 (`studio/`)
- Angular v22 SSR (`frontend/`) with `@sanity/visual-editing` + `@sanity/preview-url-secret`
- Sanity Functions (`functions/`)

## Architecture notes

- Draft-mode API routes live in `frontend/src/server.ts` **before** the Angular SSR handler
- `frontend/src/server/draft-mode.ts` — extracted handlers (vitest)
- `frontend/src/app/sanity/` — client, queries, visual editing bootstrap
- Public env vars injected via Angular `TransferState` (never expose `SANITY_API_READ_TOKEN`)

## Commands

| Command                       | Description                 |
| ----------------------------- | --------------------------- |
| `pnpm dev`                    | Studio :3333 + blog :4200   |
| `pnpm typegen`                | Sanity TypeGen              |
| `pnpm --filter frontend test` | Vitest (draft-mode helpers) |

## Agent skills

```bash
npx skills add sanity-io/agent-toolkit
npx skills add https://github.com/angular/skills
```
