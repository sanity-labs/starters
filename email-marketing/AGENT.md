# Project Guidelines

## Overview

Email marketing starter that connects Sanity Studio to Resend. Compose emails with a block-based editor, target audiences using synced Resend segments, generate content with AI, and send broadcasts via Sanity Functions. Three main directories: `studio/` (Sanity Studio), `frontend/` (Next.js), and `functions/` (Sanity Functions).

## Tech Stack

- **Studio**: Sanity Studio v5
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Functions**: Sanity Functions with Blueprint triggers (Rolldown bundler)
- **Email API**: Resend (Node SDK `resend`)
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
- `npx sanity functions env add RESEND_API_KEY <key>` — Set Resend API key on function runtime
- `npx sanity functions env add RESEND_FROM_EMAIL "Brand <updates@example.com>"` — Set the verified `from` address

## Code Style & Conventions

- ESM-first (`"type": "module"`)
- No semicolons, single quotes, no bracket spacing
- Format with `oxfmt`, lint with `eslint`
- Shared configs in `packages/@starter/` (ESLint, TypeScript, Sanity types)

## Project Structure

- `studio/` — Sanity Studio v5
  - `studio/schemaTypes/` — Core schemas: `espImport.ts`, `product.ts`, `workflow.state.ts`, `reference-data/` (`brandVoice.ts`, `segment.ts`, `urgencyStage.ts`)
  - `studio/plugins/` — Domain-organized plugins:
    - `campaign/` — Brief schema, `GenerateVariantsAction`, `CampaignGridView`, Content Agent context
    - `promotion/` — Promotion schema, email block types (`emailBlocks.ts`), `ApproveAction`, `ResendAction` (re-send action — name is unrelated to the ESP), inspectors
    - `esp/` — Resend segment sync integration, import UI
    - `preview/` — Presentation tool wiring
    - `assist/` — Field-level AI generation config
  - `studio/components/` — `ImportFromResendAction.tsx`, `EspImportDescription.tsx`, `OpenResendAction.tsx`
  - `studio/structure.ts` — Sidebar: Campaigns (All Campaigns, Email Settings: Brand Voice, Urgency Stages), Products, Resend (Sync/Import, Segments)
  - `studio/scripts/bootstrap.ts` — One-command setup
  - `studio/seed/` — Sample dataset (ndjson)
- `frontend/` — Next.js 16 + React 19 + Tailwind v4
  - `frontend/app/page.tsx` — Campaign list view
  - `frontend/app/campaigns/[id]/` — Campaign detail
  - `frontend/app/promotions/[id]/` — Promotion preview with block rendering
  - `frontend/app/api/webhooks/engagement/` — Resend engagement webhook (Svix-verified)
  - `frontend/app/api/preview/resend/[id]/` — Local react-email render preview
  - `frontend/sanity/` — Client, queries, live preview setup
- `functions/` — Sanity Functions
  - `functions/on-promotion-approved/index.ts` — Renders HTML, creates a Resend broadcast, triggers send
  - `functions/import-resend-segments/index.ts` — Syncs segments from Resend into Sanity
  - `functions/scheduled-import-resend-segments/index.ts` — Cron trigger that flips `espImport.importState` to `"requested"` every 5 minutes, causing `import-resend-segments` to run on a schedule
- `sanity.blueprint.ts` — Function triggers (delta filters), scheduled-function cron, and robot token resource. Uses `dotenv/config` to read `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` from `.env` at deploy time and inject them into the scheduled function's runtime env
- `packages/` — Shared packages: `render-email/` (@starter/render-email), `eslint-config/`, `sanity-types/`, `tsconfig/`
- `e2e/` — Playwright end-to-end tests
- `docs/` — ARCHITECTURE.md, SECURITY.md, TESTING.md

## Key Architecture Notes

- **Email rendering exists in two places**: `frontend/app/promotions/[id]/` renders React components for live preview; `functions/on-promotion-approved/` renders standalone HTML for Resend via `@starter/render-email`. Resend has no server-side render API — preview HTML is generated locally via `@react-email/render`.
- **ApproveAction and ResendAction** replace the default publish action for `promotion` documents, gated by `workflow.state`. (`ResendAction` here means "re-send" — the name predates the Resend ESP swap and is unrelated to the vendor.)
- **Blueprint triggers**: `import-resend-segments` fires on `espImport` documents when `importState == "requested"`; `on-promotion-approved` fires on `workflow.state` documents when `status == "approved"`; `scheduled-import-resend-segments` fires on the `every 5 minutes` cron expression
- **Scheduled function auth**: scheduled functions don't get a triggering-document context, so `context.clientOptions.projectId` and `dataset` are not auto-populated. The blueprint reads them from `.env` at deploy time and injects them via `env: {...}`. Token comes from the robot token (`defineRobotToken` + `robotToken: '$.resources.email-marketing-robot.token'`).
- **Resend API key and from-address** are set as function runtime environment variables (`sanity functions env add RESEND_API_KEY <key>`, `sanity functions env add RESEND_FROM_EMAIL "Brand <updates@example.com>"`). The frontend also reads `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET` from its own `.env` for the preview route and the engagement webhook.
- **Webhook verification** uses Svix (the Resend-recommended scheme). Verify on the raw request body using `resend.webhooks.verify({payload, headers, webhookSecret})`. Headers: `svix-id`, `svix-timestamp`, `svix-signature`.
- **Segments** are read-only in Sanity — managed in Resend, synced into Sanity for campaign targeting. Resend Segments are static lists; there is no behavioral/dynamic segmentation API. See `docs/ESP-NOTES.md`.

## Deploying Functions

Functions deploy via Sanity Blueprints. The blueprint config (`sanity.blueprint.ts`) lives at the **project root** and its `src` paths are relative to the root (e.g. `functions/dist/on-promotion-approved`).

1. Build from functions dir: `cd functions && pnpm run build`
2. Deploy from **project root**: `npx sanity blueprints deploy`

**Do NOT run `sanity blueprints deploy` from inside `functions/`** — it doubles the path and fails.

After any change to code in `functions/`, you must rebuild and redeploy for changes to take effect on the server.
