# Email Marketing Operations

A Sanity Studio starter for content-driven email campaign operations. Organize work around a **three-tier content model**: campaigns (governed briefs with creative direction and audience segmentation), promotions (segment-variant artifacts with approval workflows and engagement tracking), and email slots (modular, composable content blocks). Generate variants with AI, refine in multi-turn sessions, preview locally, and dispatch through Resend. All workflows operate from Studio with no hand-offs.

## Table of Contents

- [What's Included](#whats-included)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Resend Setup](#resend-setup)
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
   - Two-layer: readOnly synced from Resend (externalId, name, memberCount, lastSyncedAt)
   - Editable enrichment: affinityDescription, typicalCopyTone, engagementTier
   - Segment-specific tone enrichment persists across re-syncs
   - Resend Segments are static lists. See [`docs/ESP-NOTES.md`](./docs/ESP-NOTES.md) for what this means in practice

### Content Operations Workflows

Six workflows move content from ideation to engagement tracking, all triggered from Studio:

1. **Generate Variants (Batch)** — Content ops lead fills brief, clicks "Generate variants"; Content Agent API creates one promotion per target segment
2. **Refine Variant (Multi-Turn)** — Opens Conversation Inspector on promotion; multi-turn thread with AI suggestions; accepted changes patch promotion live
3. **Grid Review** — All promotions appear as tiles in CampaignGrid view; lead spot-checks across variants
4. **Preview and Share** — Render email HTML locally via `@react-email/render`; generate signed preview links for external reviewers
5. **Approve and Dispatch** — Trigger approval state transition; `on-promotion-approved` Function builds HTML, creates a Resend broadcast, triggers send
6. **Engagement Log-Back** — Resend (Svix-signed) webhook hits Next.js route (`/api/webhooks/engagement`); updates `promotion.campaignPerformance` metrics

### Implementation Packages

Shared packages live in `packages/`:

- **`@starter/render-email`** (at `packages/render-email/`) — react-email rendering, DOMPurify sanitization, merge-tag replacement
- **`@starter/eslint-config`** — Shared ESLint configuration
- **`@starter/sanity-types`** — Generated TypeGen types (output of `pnpm typegen`)
- **`@starter/tsconfig`** — Shared TypeScript base configs

### Studio Domain-Organized Plugins

- **campaign/** — brief schema, GenerateVariantsAction, CampaignGrid view, Content Agent context wiring
- **promotion/** — artifact schema, email slot types, VariantRefinementPanel (Conversation Inspector), workflow state machine, approval actions
- **esp/** — Resend segment sync integration, import UI, readOnly origin labels
- **preview/** — shareable link generation, Presentation tool iframe
- **assist/** — field-level AI generation configuration

### Functions (Sanity Functions)

- **on-promotion-approved** — Fires when `workflow.state` transitions to `"approved"`; renders email HTML, creates a Resend broadcast targeting the promotion's segment, triggers send
- **import-resend-segments** — Syncs segments from Resend into Sanity (triggered via `espImport` document with `importState: "requested"`)
- **scheduled-import-resend-segments** — Scheduled function that runs every 5 minutes, patches the `espImport` document's `importState` to `"requested"`, which in turn fires `import-resend-segments`. Provides background sync without manual clicks. Authenticates via a robot token defined alongside the function in `sanity.blueprint.ts`.

Engagement tracking is handled by a Next.js webhook route at `frontend/app/api/webhooks/engagement/route.ts`, not a Sanity Function.

### Preview Service

Renders email HTML locally via `@react-email/render` (Resend has no server-side render API).

| Mode                  | Consumer                      | Input                        | Auth                         | Output                 |
| :-------------------- | :---------------------------- | :--------------------------- | :--------------------------- | :--------------------- |
| Grid tile             | Studio Structure Builder      | Batch of promotion IDs (SSE) | Studio OAuth                 | Local render per tile  |
| 1:1 preview           | Content ops lead              | Single promotion ID          | Studio OAuth + preview token | Local render           |
| Shareable review link | External reviewer (no Studio) | Promotion ID + signed token  | Time-boxed PASETO/JWT        | Local render in iframe |

**Pipeline:** react-email render → DOMPurify sanitize → merge-tag stub replacement → response body

The `X-Preview-Status: local-render` response header confirms the preview was generated locally rather than via an ESP render API.

## What's Included

**Documents & Workflows**

- **Campaigns** — governed unit of work with creative brief, tone traits, personalization tokens, launch window
- **Promotions** — segment-variant artifacts (subject, preheader, disruptor, composable email slots, approval workflow, performance metrics)
- **Email Slots** — composable content blocks: header, section, CTA, divider, footer
- **Segments** — two-layer schema (readOnly synced from Resend + editable enrichment for copy tone and engagement tier)

**AI & Generation**

- **Batch variant generation** — GenerateVariantsAction on campaign creates N promotions for selected segments
- **Multi-turn refinement** — VariantRefinementPanel for iterative AI-assisted copywriting with thread history
- **@sanity/assist configuration** — Field-level AI on subject line, preheader, disruptor, block headlines

**Preview & Dispatch**

- **Local preview** — react-email render with DOMPurify sanitization and merge-tag stubs
- **Resend integration** — dispatch promotions through the Resend broadcasts API
- **Engagement feedback** — Svix-signed Resend webhooks update promotion.campaignPerformance metrics

**Platform & Security**

- **Package architecture** — semantic exports (`@starter/render-email`) with zero-dependency subpaths for tree-shaking
- **Security** — 7-layer defense: HTTPS+HSTS, auth (Studio session + preview tokens + webhook signatures), rate limiting, CSP headers, audit logging

## Prerequisites

| Requirement                                         | Notes                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Node.js 20+                                         | Required by Sanity CLI                                                               |
| pnpm                                                | Package manager                                                                      |
| [Sanity account](https://www.sanity.io/get-started) | Free                                                                                 |
| [Resend account](https://resend.com/)               | Free tier works. Must have a verified sending domain (SPF + DKIM) before live sends. |

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

This deploys the blueprint, deploys the schema, generates types, imports seed data, and prompts for your Resend API key (see [Resend Setup](#resend-setup) for how to create one). If you skip the key during bootstrap, set it later:

```bash
npx sanity functions env add on-promotion-approved RESEND_API_KEY re_your_key_here
npx sanity functions env add on-promotion-approved RESEND_FROM_EMAIL "Brand <updates@example.com>"
npx sanity functions env add import-resend-segments RESEND_API_KEY re_your_key_here
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
│   ├── schemaTypes/            # espImport, product, workflow.state, reference-data/
│   ├── plugins/                # Domain-organized plugins
│   │   ├── campaign/           # Brief schema, GenerateVariantsAction, CampaignGridView
│   │   ├── promotion/          # Promotion schema, email slots, approval actions, inspectors
│   │   ├── esp/                # Resend segment sync integration
│   │   ├── preview/            # Presentation tool wiring
│   │   └── assist/             # AI generation config
│   ├── components/             # ImportFromResendAction, OpenResendAction
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
│   │       ├── preview/resend/[id]  # Local react-email render preview
│   │       └── webhooks/engagement/ # Resend (Svix-signed) engagement webhook
│   └── sanity/                 # Client, queries, live preview
├── functions/                   # Sanity Functions
│   ├── on-promotion-approved/        # Renders HTML, creates a Resend broadcast, sends
│   ├── import-resend-segments/       # Syncs segments from Resend (on-demand)
│   └── scheduled-import-resend-segments/ # Triggers import-resend-segments every 5 minutes
├── packages/                    # Shared packages
│   ├── render-email/           # @starter/render-email (MJML, streaming, sanitization)
│   ├── eslint-config/          # @starter/eslint-config
│   ├── sanity-types/           # @starter/sanity-types (TypeGen output)
│   └── tsconfig/               # @starter/tsconfig
├── e2e/                         # Playwright end-to-end tests
├── docs/                        # ARCHITECTURE.md, SECURITY.md, TESTING.md
├── sanity.blueprint.ts          # Function trigger registrations
├── pnpm-workspace.yaml
└── package.json
```

## Resend Setup

### Creating an API Key

1. In Resend, go to **API Keys** in the left nav
2. Click **Create API Key**
3. Name it (e.g., "Sanity Starter") and choose a scope that allows sending and managing segments
4. Copy the key (format: `re_…`) — bootstrap will prompt for it, or set it manually on each function:
   ```bash
   npx sanity functions env add on-promotion-approved RESEND_API_KEY re_your_key
   npx sanity functions env add on-promotion-approved RESEND_FROM_EMAIL "Brand <updates@example.com>"
   npx sanity functions env add import-resend-segments RESEND_API_KEY re_your_key
   ```

### Verify your sending domain

Resend will not send email until your domain is verified.

1. In Resend, go to **Domains** → **Add Domain** and enter your domain (or a subdomain like `updates.example.com`)
2. Add the SPF and DKIM TXT records Resend gives you to your DNS provider
3. Wait for verification (usually a few minutes), then send `from: "Brand <updates@example.com>"`

For local testing without a verified domain, use Resend's onboarding sandbox `from: "onboarding@resend.dev"` (only delivers to your own account email).

### Webhooks

1. In Resend, go to **Webhooks** → **Add Webhook**
2. Endpoint URL: `https://<your-frontend-domain>/api/webhooks/engagement`
3. Subscribe to: `email.opened`, `email.clicked`, `email.bounced`, `email.delivered`, `email.complained`
4. Copy the signing secret Resend generates and set `RESEND_WEBHOOK_SECRET` in your frontend `.env`

Resend webhooks are verified via Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`). Verification runs on the raw request body inside `frontend/app/api/webhooks/engagement/route.ts`.

### Segments

Resend Segments are **static** — you push contacts into them, they don't update based on behavior. This starter syncs segments into Sanity so you can target broadcasts from a campaign brief and enrich each segment with copy tone and engagement tier metadata that persists across re-syncs. See [`docs/ESP-NOTES.md`](./docs/ESP-NOTES.md) for what Resend does and doesn't do compared to a behavioral marketing platform.

## How It Works

### Resend Integration

- Open **Sync / Import** in the Studio sidebar and click **Import from Resend** to pull in all segments as read-only Sanity documents
- When an approved promotion is published, a Sanity Function renders the email to HTML, creates a Resend broadcast targeting the promotion's segment, and triggers the send
- Each promotion stores the returned `broadcast.id` as `externalCampaignId` with a deep-link to `https://resend.com/broadcasts/{id}`

### AI Email Generation

1. Open any email document and fill in the **creative brief** field
2. Click **Generate with AI** — the agent uses brand voice settings and audience context from the campaign's lists/segments
3. Generates a subject line, preheader, and full block-based email body
4. Regenerate from the same brief at any time; generation count is tracked

### Campaign Management

- Create campaigns that reference one or more Resend segments for targeting
- Generate one promotion per target segment from the campaign brief
- Status workflow gates sending: **draft → ready-for-review → approved**
- Approving a promotion automatically triggers the send function
- Sent or errored promotions can be re-sent

### Email Preview

- The Next.js frontend renders email body blocks as a live preview
- Uses Sanity Presentation Tool for a real-time editing experience
- Supported block types: header (logo + brand), sections (image + text), CTAs, product grids (2-column), dividers, footer

## Security

This starter implements a **7-layer security posture** for the preview service:

1. **Transport** — HTTPS + HSTS
2. **Authentication (3 paths)** — Studio session cookie, @sanity/preview-url-secret tokens, Svix-signed Resend webhooks
3. **Input validation** — Whitelist document IDs, enum values, content-type enforcement
4. **Render-time** — DOMPurify sanitization, react-email render, merge-tag syntax preserved (not eval'd)
5. **Output headers** — CSP, X-Content-Type-Options, X-Frame-Options, Permissions-Policy
6. **Rate limiting** — Per-IP token bucket (100 req/min default, configurable)
7. **Audit logging** — Timestamp, method, path, status, IP, duration (redacted for PII)

See [SECURITY.md](./docs/SECURITY.md) for the full threat model, configuration checklist, and mitigation strategies.

## Testing

Unit tests for streaming pipelines, middleware, and connectors; integration tests for preview routes; load testing guidance.

See [TESTING.md](./docs/TESTING.md) for test examples and strategy.

## Environment Variables

### Root `.env`

| Variable                   | Description            |
| -------------------------- | ---------------------- |
| `SANITY_STUDIO_PROJECT_ID` | Your Sanity project ID |
| `SANITY_STUDIO_DATASET`    | Dataset name           |

### Frontend `.env`

| Variable                        | Description                                                       |
| ------------------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Your Sanity project ID                                            |
| `NEXT_PUBLIC_SANITY_DATASET`    | Dataset name (defaults to `production`)                           |
| `SANITY_API_READ_TOKEN`         | Sanity API token with Viewer permissions (read-only)              |
| `RESEND_API_KEY`                | Resend API key for the preview route (`/api/preview/resend/[id]`) |
| `RESEND_WEBHOOK_SECRET`         | Svix signing secret used to verify Resend webhook payloads        |
| `RESEND_FROM_EMAIL`             | Verified sending address (e.g., `"Brand <updates@example.com>"`)  |

### Function Runtime

| Variable                                            | How to Set                                                                                                                                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`                                    | Set during bootstrap, or manually: `npx sanity functions env add on-promotion-approved RESEND_API_KEY <key>` and `npx sanity functions env add import-resend-segments RESEND_API_KEY <key>`                 |
| `RESEND_FROM_EMAIL`                                 | `npx sanity functions env add on-promotion-approved RESEND_FROM_EMAIL "Brand <updates@example.com>"` — must be on a verified domain                                                                         |
| `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET` | Read by `scheduled-import-resend-segments` to construct a Sanity client. Injected automatically at deploy time from the root `.env` via `dotenv/config` in `sanity.blueprint.ts` — no manual step required. |

## Learn More

- [Sanity Studio](https://www.sanity.io/docs/sanity-studio)
- [Sanity Functions](https://www.sanity.io/docs/functions)
- [Resend docs](https://resend.com/docs)
- [Resend `llms.txt`](https://resend.com/llms.txt) — canonical AI entry point
- [Next.js](https://nextjs.org/docs)
