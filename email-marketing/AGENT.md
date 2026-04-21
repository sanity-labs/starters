# Project Guidelines

## Overview

Email marketing starter that connects Sanity Studio to Klaviyo. Compose emails with a block-based editor, target audiences using synced Klaviyo lists and segments, generate content with AI, and send campaigns via Sanity Functions. Three main directories: `studio/` (Sanity Studio), `frontend/` (Next.js), and `functions/` (Sanity Functions).

## Tech Stack

- **Studio**: Sanity Studio v5
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Functions**: Sanity Functions with Blueprint triggers (Rolldown bundler)
- **Email API**: Klaviyo REST API (revision `2025-07-15`)
- **AI**: Sanity AI Agent Actions (`client.agent.action.generate()`)
- **Styling**: Tailwind CSS 4 (frontend), `@sanity/ui` (studio)
- **Language**: TypeScript (strict)

## Development Commands

### Root (runs all workspaces)

- `pnpm install` — Install all dependencies
- `pnpm dev` — Start Studio, frontend, and functions concurrently
- `pnpm build` — Build all workspaces
- `pnpm bootstrap` — Deploy blueprint + schema, generate types, seed data
- `pnpm typegen` — Regenerate Sanity TypeGen types
- `pnpm typecheck` — Type-check all workspaces
- `pnpm lint` — Run ESLint
- `pnpm format` — Format with oxfmt

### Studio-specific (from `studio/`)

- `npx sanity schema deploy` — Deploy schema to Sanity cloud
- `npx sanity deploy` — Deploy Studio to Sanity hosting

### Blueprints & Functions (from project root)

- `cd functions && pnpm run build` — Build functions
- `npx sanity blueprints deploy` — Deploy function triggers
- `npx sanity functions env add KLAVIYO_API_KEY <key>` — Set Klaviyo API key on function runtime

## Code Style & Conventions

- ESM-first (`"type": "module"`)
- No semicolons, single quotes, no bracket spacing
- Format with `oxfmt`, lint with `eslint`
- Shared configs in `packages/@starter/` (ESLint, TypeScript, Sanity types)

## Project Structure

- `studio/` — Sanity Studio v5
  - `studio/schemaTypes/` — Document schemas: `email.ts`, `campaign.ts`, `list.ts`, `audience.ts` (segments), `emailSettings.ts`, `klaviyoImport.ts`, `product.ts`, plus email body block types
  - `studio/components/` — Custom Studio components: `GenerateEmailButton.tsx` (AI generation), `SendPublishAction.tsx` (gated publish+send), `ImportFromKlaviyoAction.tsx` (sync trigger), `KlaviyoDocumentDescription.tsx`, `OpenKlaviyoAction.tsx`
  - `studio/structure.ts` — Sidebar: Campaigns, Products, Email Settings (Settings, Klaviyo sync, Lists, Segments)
  - `studio/scripts/bootstrap.ts` — One-command setup
  - `studio/seed/` — Sample dataset (ndjson)
- `frontend/` — Next.js 16 + React 19 + Tailwind v4
  - `frontend/app/page.tsx` — Email list view with status badges
  - `frontend/app/emails/preview/[id]/` — Email preview with block rendering
  - `frontend/sanity/` — Client, queries, live preview setup
- `functions/` — Sanity Functions
  - `functions/send-email/index.ts` — Renders HTML, creates Klaviyo template + campaign, triggers send
  - `functions/import-klaviyo/index.ts` — Syncs lists & segments from Klaviyo into Sanity
  - `functions/lib/klaviyo.ts` — Klaviyo API client (base URL, auth, rate limiting, error handling)
  - `functions/lib/mjml.ts` — Email HTML renderer (responsive HTML with product grids, CTA buttons, unsubscribe links)
- `sanity.blueprint.ts` — Function triggers (delta filters)
- `packages/@starter/` — Shared configs (ESLint, TypeScript, Sanity types)

## Key Architecture Notes

- **Email rendering exists in two places**: `frontend/app/emails/preview/` renders React components for live preview; `functions/lib/mjml.ts` renders standalone HTML for Klaviyo (with Handlebars variables like `{{ unsubscribe_url }}`)
- **SendPublishAction** replaces the default publish action for `emailMessage` documents, gated by status workflow
- **Blueprint triggers**: `import-klaviyo` fires on `klaviyoImport` documents when `importState == "requested"`; `send-email` fires on `emailMessage` documents when `status == "approved"` and `sendState` is not `"sent"` or `"sending"`
- **Klaviyo API key** is set as a function runtime environment variable (`sanity functions env add`), not stored in `.env` files
- **Lists and segments** are read-only in Sanity — managed in Klaviyo, synced into Sanity for campaign targeting

## Deploying Functions

Functions deploy via Sanity Blueprints. The blueprint config (`sanity.blueprint.ts`) lives at the **project root** and its `src` paths are relative to the root (e.g. `functions/dist/send-email`).

1. Build from functions dir: `cd functions && pnpm run build`
2. Deploy from **project root**: `npx sanity blueprints deploy`

**Do NOT run `sanity blueprints deploy` from inside `functions/`** — it doubles the path and fails.

After any change to code in `functions/`, you must rebuild and redeploy for changes to take effect on the server.
