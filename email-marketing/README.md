# Email Marketing Operations

A Sanity Studio starter for content-driven email campaign operations. Organize work around a **three-tier content model**: campaigns (governed briefs with creative direction and audience segmentation), promotions (segment-variant artifacts with approval workflows and engagement tracking), and emailSlots (modular, reusable content blocks). Generate variants with AI, refine in multi-turn sessions, preview with accuracy badges, and dispatch to ESP (Klaviyo integration included). All workflows operate from Studio with no hand-offs.

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

The email marketing starter is built around a **three-tier content model** where the campaign brief is the canonical unit of work, promotions are segment-variant artifacts, and emailSlots are modular, reusable blocks. This separation enables content governance, parallel variant generation, and performance tracking without duplication.

### Three-Tier Document Model

1. **Campaign** (The Brief)
   - Structured governance document holding campaign intent, creative direction, audience segments, launch window, personalization context
   - Fields: title, description, primaryMessage, supportingMessage, toneTraits, emotionalGoal, previewContext, workflow.state
   - Single source of truth for campaign narrative across all derived surfaces

2. **Promotion** (The Artifact)
   - Segment-variant artifact produced from the brief; one base + one per target segment
   - Fields: campaign (ref), segment (ref, nullable), subjectLine, preheader, disruptor, emailSlots (array), workflow.state, campaignPerformance (readOnly)
   - References the brief; inherits tone traits and applies segment-specific enrichment
   - Tracks engagement metrics (openRate, clickRate, conversionRate, sendCount)

3. **EmailSlot** (The Module)
   - Reusable content block with position (hero, cta, footer, etc.), asset reference (DAM), headline, subheadline, CTA
   - Composed into promotions; changes to assets cascade to all references
   - Keeps pixel data out of Sanity; Sanity carries the composition

4. **Segment** (Reference Data)
   - Two-layer: readOnly synced from Klaviyo (externalId, name, memberCount, lastSyncedAt)
   - Editable enrichment: affinityDescription, typicalCopyTone, engagementTier
   - Segment-specific tone enrichment persists across re-syncs

### Content Operations Workflows

Six workflows move content from ideation to engagement tracking, all triggered from Studio:

1. **Generate Variants (Batch)** — Content ops lead fills brief, clicks "Generate variants"; Content Agent API creates one promotion per target segment
2. **Refine Variant (Multi-Turn)** — Opens Conversation Inspector on promotion; multi-turn thread with AI suggestions; accepted changes patch promotion live
3. **Grid Review** — All promotions (base + variants) appear as tiles in CampaignGrid view; lead spot-checks across variants
4. **Preview and Share** — Render email HTML with accuracy badges; generate signed preview links for external reviewers
5. **Approve and Dispatch** — Trigger approval state transition; `on-promotion-approved` Function composes ESP payload, creates campaign, triggers send
6. **Engagement Log-Back** — ESP webhook fires on open/click/conversion; `engagement-log-back` Function updates `promotion.campaignPerformance` metrics

### Implementation Packages

All domain logic is in `packages/@starter/` (npm scope `@starter/`) with semantic, zero-dependency subpaths for tree-shaking:

- **`@starter/render-email`** (at `packages/@starter/render-email/`) — MJML compilation, streaming HTML output, DOMPurify sanitization, Handlebars stub replacement
  - Exports: `./streaming` (MJML → Readable stream), `./stubs` (token replacement), `./sanitize` (email-safe config), `./types`
- **`@starter/esp-connector`** (at `packages/@starter/esp-connector/`) — ESP-agnostic interface + Klavioy implementation
  - Exports: `./interface` (EspConnector type), `./klaviyo` (KlaviyoConnector), extensible for Braze/AJO
- **`@starter/preview-middleware`** (at `packages/@starter/preview-middleware/`) — Composable auth, rate-limit, security-headers, audit logging
  - Exports: `./auth` (Studio OAuth, preview tokens, webhook signatures), `./rate-limit` (per-IP, per-token, per-document), `./security-headers`, `./logging`

### Studio Domain-Organized Plugins

- **campaign/** — brief schema, GenerateVariantsAction, CampaignGrid view, Content Agent context wiring
- **promotion/** — artifact schema, VariantRefinementPanel (Conversation Inspector), workflow state machine, approval actions
- **klaviyo/** — segment sync integration, import UI, readOnly origin labels
- **preview/** — shareable link generation (signed PASETO/JWT), Presentation tool iframe
- **assist/** — field-level AI generation configuration

### Functions (Sanity Functions)

- **on-promotion-approved** — Fires when promotion.workflow.state transitions to "approved"; composes ESP payload, creates campaign, triggers send
- **import-klaviyo** — Syncs lists and segments from Klaviyo into Sanity (triggered via `klaviyoImport` document with `importState: "requested"`)
- **on-slot-needs-asset** — Notifies creatives when emailSlot.asset is unfilled
- **engagement-log-back** — Inbound ESP webhook (Klaviyo); verifies signature; updates promotion.campaignPerformance with aggregated metrics

### Preview Service (Separate Next.js App)

Renders email HTML with four modes and strict authentication:

| Mode                  | Consumer                      | Input                        | Auth                         | Output                          |
| :-------------------- | :---------------------------- | :--------------------------- | :--------------------------- | :------------------------------ |
| Grid tile             | Studio Structure Builder      | Batch of promotion IDs (SSE) | Studio OAuth                 | Local MJML per tile             |
| 1:1 preview           | Content ops lead              | Single promotion ID          | Studio OAuth + preview token | Local MJML + accuracy badge     |
| Klavioy verification  | CRM manager                   | Promotion ID                 | Preview token                | Klavioy API render with stubs   |
| Shareable review link | External reviewer (no Studio) | Promotion ID + signed token  | Time-boxed PASETO/JWT        | Local or Klavioy MJML in iframe |

**Streaming pipeline:** MJML render → DOMPurify sanitize → Handlebars stub replacement → TextEncoder → response body

**Accuracy badge** (X-Preview-Status header): Counts resolved sample values vs. send-time-only tags vs. unresolved variables

## What's Included

**Documents & Workflows**

- **Campaigns** — governed unit of work with creative brief, tone traits, personalization tokens, launch window
- **Promotions** — segment-variant artifacts (subject, preheader, disruptor, modular email slots, approval workflow, performance metrics)
- **EmailSlots** — reusable content blocks with position, asset, headline, subheadline, CTA
- **Segments** — two-layer schema (readOnly synced from Klaviyo + editable enrichment for copy tone and engagement tier)

**AI & Generation**

- **Batch variant generation** — GenerateVariantsAction on campaign creates N promotions for selected segments
- **Multi-turn refinement** — VariantRefinementPanel for iterative AI-assisted copywriting with thread history
- **@sanity/assist configuration** — Field-level AI on subject line, preheader, disruptor, slot headlines

**Preview & Dispatch**

- **Streaming preview** — MJML → HTML with DOMPurify sanitization, Handlebars stubs, accuracy badges (X-Preview-Status)
- **Klaviyo integration** — dispatch promotions to Klaviyo with template creation and campaign sending
- **Engagement feedback** — inbound Klaviyo webhooks update promotion.campaignPerformance metrics

**Analytics & Management**

- **Campaign dashboard** — standalone App SDK app for cycle time, variant coverage, cross-segment performance
- **Approval workflow** — workflow.state parallel documents track promotion status, approvers, history

**Platform & Security**

- **Package architecture** — semantic exports (@starter/render-email, @starter/esp-connector, @starter/preview-middleware) with zero-dependency subpaths for tree-shaking
- **Security** — 7-layer defense: HTTPS+HSTS, auth (Studio session + preview tokens + webhook signatures), rate limiting, CSP headers, audit logging
- **Middleware stack** — composable auth, rate-limit, security-headers, audit logging for preview service

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
npx sanity functions env add send-email KLAVIYO_API_KEY pk_your_key_here
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
│   ├── schemaTypes/            # Email, campaign, list, segment, product, settings schemas
│   ├── components/             # GenerateEmailButton, SendPublishAction, ImportFromKlaviyoAction, etc.
│   ├── scripts/bootstrap.ts    # One-command project setup
│   ├── structure.ts            # Studio sidebar navigation
│   └── seed/                   # Sample dataset
├── frontend/                    # Next.js 16 + React 19 + Tailwind v4
│   ├── app/
│   │   ├── page.tsx           # Email list view
│   │   └── emails/preview/    # Email preview pages
│   └── sanity/                # Client, queries, live preview
├── functions/                   # Sanity Functions
│   ├── send-email/            # Renders HTML, creates Klaviyo campaign, sends
│   ├── import-klaviyo/        # Syncs lists & segments from Klaviyo
│   └── lib/
│       ├── klaviyo.ts         # Klaviyo API client
│       └── mjml.ts            # Email HTML renderer
├── packages/@starter/          # Shared configs (ESLint, TypeScript, Sanity types)
├── sanity.blueprint.ts         # Function trigger registrations
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
   npx sanity functions env add send-email KLAVIYO_API_KEY pk_your_key
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

This starter implements a **7-layer security posture** for the preview service:

1. **Transport** — HTTPS + HSTS
2. **Authentication (3 paths)** — Studio session cookie, @sanity/preview-url-secret tokens, Klaviyo webhook signatures
3. **Input validation** — Whitelist document IDs, enum values, content-type enforcement
4. **Render-time** — DOMPurify sanitization, MJML validation, Handlebars syntax preserved (not eval'd)
5. **Output headers** — CSP, X-Content-Type-Options, X-Frame-Options, Permissions-Policy
6. **Rate limiting** — Per-IP token bucket (100 req/min default, configurable)
7. **Audit logging** — Timestamp, method, path, status, IP, duration (redacted for PII)

See [SECURITY.md](./SECURITY.md) for the full threat model, configuration checklist, and mitigation strategies.

## Testing

Unit tests for streaming pipelines, middleware, and connectors; integration tests for preview routes; load testing guidance.

See [TESTING.md](./TESTING.md) for test examples and strategy.

## Environment Variables

### Root `.env`

| Variable                   | Description            |
| -------------------------- | ---------------------- |
| `SANITY_STUDIO_PROJECT_ID` | Your Sanity project ID |
| `SANITY_STUDIO_DATASET`    | Dataset name           |

### Frontend `.env`

| Variable                        | Description                             |
| ------------------------------- | --------------------------------------- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Your Sanity project ID                  |
| `NEXT_PUBLIC_SANITY_DATASET`    | Dataset name (defaults to `production`) |

### Function Runtime

| Variable          | How to Set                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KLAVIYO_API_KEY` | Set during bootstrap, or manually: `npx sanity functions env add send-email KLAVIYO_API_KEY <key>` and `npx sanity functions env add import-klaviyo KLAVIYO_API_KEY <key>` |

## Learn More

- [Sanity Studio](https://www.sanity.io/docs/sanity-studio)
- [Sanity Functions](https://www.sanity.io/docs/functions)
- [Klaviyo API](https://developers.klaviyo.com/en/reference/api_overview)
- [Next.js](https://nextjs.org/docs)
