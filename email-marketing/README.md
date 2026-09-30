# Email Marketing Operations

A Sanity Studio starter for content-driven email campaign operations. Organize work around a **three-tier content model**: campaigns (governed briefs with creative direction and audience segmentation), promotions (segment-variant artifacts with approval workflows and engagement tracking), and email slots (modular, composable content blocks). Generate variants with AI, refine in multi-turn sessions, preview with accuracy badges, and dispatch to ESP (Klaviyo integration included). All workflows operate from Studio with no hand-offs.

## Table of Contents

- [What's Included](#whats-included)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Klaviyo Setup](#klaviyo-setup)
- [Security](#security)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [Learn More](#learn-more)

## Architecture

The email marketing starter is built around a **three-tier content model** where the campaign brief is the canonical unit of work, promotions are segment-variant artifacts, and email slots are modular, composable content pieces. This separation enables content governance, parallel variant generation, and performance tracking without duplication.

### Three-Tier Document Model

1. **Campaign** (The Brief)
   - Structured governance document holding campaign intent, creative direction, audience segments, launch window, personalization context
   - Fields: title, description, primaryMessage, supportingMessage, toneTraits, emotionalGoal, previewContext, workflow.state
   - Single source of truth for campaign narrative across all derived surfaces

2. **Promotion** (The Artifact)
   - Segment-variant artifact produced from the brief; one per target segment
   - Fields: campaign (ref), segment (ref), subjectLine, preheader, disruptor, emailSlots (array of email slot types), workflow.state, campaignPerformance (readOnly)
   - References the brief; inherits tone traits and applies segment-specific enrichment
   - Tracks engagement metrics (openRate, clickThroughRate, conversionRate)

3. **Email Slots** (The Modules)
   - Composable inline object types assembled into a promotion's `emailSlots` array
   - Block types: `emailHeader` (logo + brand name), `emailSection` (headline, body, image, products), `emailCTA` (button with primary/secondary style), `emailDivider` (spacing), `emailFooter` (legal text + unsubscribe)
   - Defined in `studio/plugins/promotion/schemaTypes/emailBlocks.ts`

4. **Segment** (Reference Data)
   - Two-layer: readOnly synced from Klaviyo (externalId, name, memberCount, lastSyncedAt)
   - Editable enrichment: affinityDescription, typicalCopyTone, engagementTier
   - Segment-specific tone enrichment persists across re-syncs

### Content Operations Workflows

Six workflows move content from ideation to engagement tracking, all triggered from Studio:

1. **Generate Variants (Batch)** — Content ops lead fills brief, clicks "Generate variants"; Content Agent API creates one promotion per target segment
2. **Refine Variant (Multi-Turn)** — Opens Conversation Inspector on promotion; multi-turn thread with AI suggestions; accepted changes patch promotion live
3. **Grid Review** — All promotions appear as tiles in CampaignGrid view; lead spot-checks across variants
4. **Preview and Share** — Render email HTML with accuracy badges; generate signed preview links for external reviewers
5. **Approve and Dispatch** — Trigger approval state transition; `on-promotion-approved` Function composes ESP payload, creates campaign, triggers send
6. **Engagement Log-Back** — ESP webhook hits Next.js route (`/api/webhooks/engagement`); updates `promotion.campaignPerformance` metrics

### Implementation Packages

Shared packages live in `packages/`:

- **`@starter/render-email`** (at `packages/render-email/`) — MJML compilation, whole-document DOMPurify sanitization for previews, HTML escaping helpers shared with the send Function, Klaviyo stub handling
  - Exports: `.` (`renderPromotionLocal`, `renderPromotionKlaviyo`), `./sanitize` (`sanitizeEmailHtml`), `./escape` (`escapeHtml`, `safeHttpUrl`, dependency-free), `./stubs` (token replacement), `./streaming` (async-iterable helpers), `./types`
- **`@starter/eslint-config`** — Shared ESLint configuration
- **`@starter/sanity-types`** — Generated TypeGen types (output of `pnpm typegen`)
- **`@starter/tsconfig`** — Shared TypeScript base configs

### Studio Domain-Organized Plugins

- **campaign/** — brief schema, GenerateVariantsAction, CampaignGrid view, Content Agent context wiring
- **promotion/** — artifact schema, email slot types, VariantRefinementPanel (Conversation Inspector), workflow state machine, approval actions
- **klaviyo/** — segment sync integration, import UI, readOnly origin labels
- **preview/** — shareable link generation, Presentation tool iframe
- **assist/** — field-level AI generation configuration

### Functions (Sanity Functions)

- **on-promotion-approved** — Fires when `workflow.state` transitions to `"approved"`; renders email HTML, creates Klaviyo template and campaign, triggers send
- **import-klaviyo** — Syncs lists and segments from Klaviyo into Sanity (triggered via `klaviyoImport` document with `importState: "requested"`)
- **scheduled-import-klaviyo** — Scheduled function that runs every 12 hours (midnight and noon Pacific time), patches the `klaviyoImport` document's `importState` to `"requested"`, which in turn fires `import-klaviyo`. Provides background sync without manual clicks. Authenticates via a robot token defined alongside the function in `sanity.blueprint.ts`.

Engagement tracking is handled by a Next.js webhook route at `frontend/app/api/webhooks/engagement/route.ts`, not a Sanity Function.

### Preview (Next.js frontend)

Two preview surfaces live in `frontend/`:

| Surface                     | Route                       | Auth                                             | Output                                                      |
| :-------------------------- | :-------------------------- | :----------------------------------------------- | :---------------------------------------------------------- |
| React preview page          | `/promotions/[id]`          | Draft mode via the Presentation tool             | Blocks rendered as React components, tokens sample-resolved |
| Klaviyo verification render | `/api/preview/klaviyo/[id]` | `SANITY_PREVIEW_SECRET` (required in production) | Full email HTML, sanitized, with `X-Preview-Status` header  |

**Klaviyo route pipeline:** fetch promotion → `renderPromotionKlaviyo` (MJML, fields escaped) → optional Klaviyo template render when `KLAVIYO_API_KEY` is set → `sanitizeEmailHtml` (DOMPurify over the whole document) → response with strict CSP headers

**Accuracy badge** (`X-Preview-Status` header): Counts resolved sample values vs. send-time-only tags

## What's Included

**Documents & Workflows**

- **Campaigns** — governed unit of work with creative brief, tone traits, personalization tokens, launch window
- **Promotions** — segment-variant artifacts (subject, preheader, disruptor, composable email slots, approval workflow, performance metrics)
- **Email Slots** — composable content blocks: header, section, CTA, divider, footer
- **Segments** — two-layer schema (readOnly synced from Klaviyo + editable enrichment for copy tone and engagement tier)

**AI & Generation**

- **Batch variant generation** — GenerateVariantsAction on campaign creates N promotions for selected segments
- **Multi-turn refinement** — VariantRefinementPanel for iterative AI-assisted copywriting with thread history
- **@sanity/assist configuration** — Field-level AI on subject line, preheader, disruptor, block headlines

**Preview & Dispatch**

- **Klaviyo preview route** — MJML to HTML, optional Klaviyo render, DOMPurify sanitization, accuracy header (X-Preview-Status)
- **Klaviyo integration** — dispatch promotions to Klaviyo with template creation and campaign sending
- **Engagement feedback** — inbound Klaviyo webhooks update promotion.campaignPerformance metrics

**Platform & Security**

- **Package architecture** — semantic exports (`@starter/render-email`) with a dependency-free `./escape` subpath the send Function can bundle
- **Security** — content escaped at render time in both the preview renderer and the live send, whole-document DOMPurify sanitization and strict CSP on previews, shared-secret preview auth that fails closed in production, HMAC-verified engagement webhooks

## Prerequisites

| Requirement                                         | Notes                                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Node.js 20+                                         | Required by Sanity CLI                                                                        |
| pnpm                                                | Package manager                                                                               |
| [Sanity account](https://www.sanity.io/get-started) | Free                                                                                          |
| [Klaviyo account](https://www.klaviyo.com/)         | Free tier works. Must have at least **one List** created (campaigns require a list audience). |

## Quick Start

### 1. Create the project

```bash
pnpm create sanity@latest --template sanity-labs/starters/email-marketing --package-manager pnpm
```

### 2. Bootstrap

```bash
cd your-project
pnpm bootstrap
```

This deploys the blueprint, deploys the schema, generates types, imports seed data, and prompts for your Klaviyo API key (see [Klaviyo Setup](#klaviyo-setup) for how to create one). If you skip the key during bootstrap, set it later:

```bash
npx sanity functions env add on-promotion-approved KLAVIYO_API_KEY pk_your_key_here
npx sanity functions env add import-klaviyo KLAVIYO_API_KEY pk_your_key_here
```

### 3. Start development

```bash
pnpm dev
```

Studio runs at `http://localhost:3333`, frontend at `http://localhost:3000`.

## Project Structure

```
email-marketing/
├── studio/                      # Sanity Studio v5
│   ├── schemaTypes/            # klaviyoImport, product, workflow.state, reference-data/
│   ├── plugins/                # Domain-organized plugins
│   │   ├── campaign/           # Brief schema, GenerateVariantsAction, CampaignGridView
│   │   ├── promotion/          # Promotion schema, email slots, approval actions, inspectors
│   │   ├── klaviyo/            # Segment sync integration
│   │   ├── preview/            # Presentation tool wiring
│   │   └── assist/             # AI generation config
│   ├── components/             # ImportFromKlaviyoAction, OpenKlaviyoAction
│   ├── scripts/bootstrap.ts    # One-command project setup
│   ├── structure.ts            # Studio sidebar navigation
│   └── seed/                   # Sample dataset
├── frontend/                    # Next.js 16 + React 19 + Tailwind v4
│   ├── app/
│   │   ├── page.tsx            # Campaign list view
│   │   ├── campaigns/[id]/     # Campaign detail
│   │   ├── promotions/[id]/    # Promotion preview with block rendering
│   │   └── api/
│   │       ├── draft-mode/enable/   # Draft mode endpoint
│   │       ├── preview/klaviyo/[id] # Klaviyo render preview
│   │       └── webhooks/engagement/ # ESP engagement webhook
│   └── sanity/                 # Client, queries, live preview
├── functions/                   # Sanity Functions
│   ├── on-promotion-approved/  # Renders HTML, creates Klaviyo campaign, sends
│   ├── import-klaviyo/         # Syncs lists & segments from Klaviyo (on-demand)
│   └── scheduled-import-klaviyo/ # Triggers import-klaviyo every 12h (midnight & noon PT)
├── packages/                    # Shared packages
│   ├── render-email/           # @starter/render-email (MJML, sanitization, escaping)
│   ├── eslint-config/          # @starter/eslint-config
│   ├── sanity-types/           # @starter/sanity-types (TypeGen output)
│   └── tsconfig/               # @starter/tsconfig
├── e2e/                         # Playwright end-to-end tests
├── docs/                        # ARCHITECTURE.md, SECURITY.md, TESTING.md
├── sanity.blueprint.ts          # Function trigger registrations
├── pnpm-workspace.yaml
└── package.json
```

## Klaviyo Setup

### Creating an API Key

1. In Klaviyo, go to **Settings** (bottom-left gear icon) → **API Keys**
2. Click **Create Private API Key**
3. Name it (e.g., "Sanity Starter") and select **Custom** scope
4. Enable these scopes:

   | Scope     | Access     |
   | --------- | ---------- |
   | Lists     | Read       |
   | Segments  | Read       |
   | Templates | Read/Write |
   | Campaigns | Read/Write |

5. Copy the key — bootstrap will prompt for it, or set it manually:
   ```bash
   npx sanity functions env add on-promotion-approved KLAVIYO_API_KEY pk_your_key
   npx sanity functions env add import-klaviyo KLAVIYO_API_KEY pk_your_key
   ```

### Lists and Segments

**Lists** are static subscriber groups — people opt in via forms or imports. **Segments** are dynamic and auto-update based on conditions like purchase history or engagement. This starter imports both from Klaviyo so you can target campaigns directly in Sanity.

You need **at least one List** in your Klaviyo account before using this starter, since campaigns require a list as an audience.

## How It Works

### Klaviyo Integration

- Open **Sync / Import** in the Studio sidebar and click **Import from Klaviyo** to pull in all lists and segments as read-only Sanity documents
- When an approved email is published, a Sanity Function renders the email to HTML, creates a Klaviyo template and campaign with the configured audience targeting, and triggers the send
- The send log on each email document records Klaviyo campaign IDs with direct links

### AI Email Generation

1. Open any email document and fill in the **creative brief** field
2. Click **Generate with AI** — the agent uses brand voice settings and audience context from the campaign's lists/segments
3. Generates a subject line, preheader, and full block-based email body
4. Regenerate from the same brief at any time; generation count is tracked

### Campaign Management

- Create campaigns that reference lists (required) and optionally include/exclude segments
- Assign one email per campaign (emails can't be shared across campaigns)
- Status workflow gates sending: **draft → ready-for-review → approved**
- Publishing an approved email automatically triggers the send function
- Sent or errored emails can be resent

### Email Preview

- The Next.js frontend renders email body blocks as a live preview
- Uses Sanity Presentation Tool for a real-time editing experience
- Supported block types: header (logo + brand), sections (image + text), CTAs, product grids (2-column), dividers, footer

## Security

What the code does today:

- **Output escaping** — every authored field and URL is escaped (`escapeHtml`) and URL-scheme-checked (`safeHttpUrl`) in both the MJML preview renderer and the `on-promotion-approved` send Function, so HTML in content never ships to subscribers
- **Preview sanitization** — the Klaviyo preview route runs the whole rendered document through DOMPurify once and serves it with a strict CSP (`default-src 'none'`), `X-Frame-Options`, `nosniff`, HSTS, and `Permissions-Policy`
- **Preview auth** — `SANITY_PREVIEW_SECRET` gates `/api/preview/klaviyo/[id]`; in production the route refuses requests (HTTP 500 + server log) when the secret is unset instead of falling open
- **Webhook signatures** — the engagement webhook verifies Klaviyo's HMAC-SHA256 when `KLAVIYO_WEBHOOK_SECRET` is set (it accepts unsigned requests when unset; set it before exposing the route)

Not implemented, and worth adding before production: per-link expiring preview tokens (`@sanity/preview-url-secret`), rate limiting, audit logging, and host allow-listing if you ever fetch authored URLs server-side.

See [SECURITY.md](./docs/SECURITY.md) for the threat model, where each control lives, and the configuration checklist.

## Testing

Unit tests (`pnpm test`) cover the MJML renderer, output escaping, the preview sanitizer, and Klaviyo stub handling; Playwright end-to-end tests live in `e2e/`.

See [TESTING.md](./docs/TESTING.md) for test examples and strategy.

## Environment Variables

### Root `.env`

| Variable                   | Description            |
| -------------------------- | ---------------------- |
| `SANITY_STUDIO_PROJECT_ID` | Your Sanity project ID |
| `SANITY_STUDIO_DATASET`    | Dataset name           |

### Frontend `.env`

| Variable                        | Description                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Your Sanity project ID                                                                                                                                       |
| `NEXT_PUBLIC_SANITY_DATASET`    | Dataset name (defaults to `production`)                                                                                                                      |
| `SANITY_API_READ_TOKEN`         | Sanity API token with Viewer permissions (read-only)                                                                                                         |
| `SANITY_PREVIEW_SECRET`         | Shared secret for the preview route, passed as `?sanity-preview-secret=`. Required in production (the route returns 500 without it); optional in development |
| `KLAVIYO_API_KEY`               | Klaviyo private API key for the preview route (`/api/preview/klaviyo/[id]`)                                                                                  |

### Function Runtime

| Variable                                            | How to Set                                                                                                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KLAVIYO_API_KEY`                                   | Set during bootstrap, or manually: `npx sanity functions env add on-promotion-approved KLAVIYO_API_KEY <key>` and `npx sanity functions env add import-klaviyo KLAVIYO_API_KEY <key>`               |
| `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET` | Read by `scheduled-import-klaviyo` to construct a Sanity client. Injected automatically at deploy time from the root `.env` via `dotenv/config` in `sanity.blueprint.ts` — no manual step required. |

## Learn More

- [Sanity Studio](https://www.sanity.io/docs/sanity-studio)
- [Sanity Functions](https://www.sanity.io/docs/functions)
- [Klaviyo API](https://developers.klaviyo.com/en/reference/api_overview)
- [Next.js](https://nextjs.org/docs)
