---
name: email-marketing-ops
description: 'Build multi-variant email campaigns with AI, streaming preview, and Klaviyo dispatch. Covers three-tier document model (campaign brief → promotion artifact → email slot), batch variant generation, multi-turn refinement, @sanity/agent-context wiring, preview accuracy badges, security (7-layer defense), and engagement feedback. Supports both greenfield (new Sanity studio) and brownfield (adding to existing) patterns. Trigger on: email marketing, variant generation, campaign dashboard, Klaviyo sync, preview service, engagement metrics, segment enrichment, email dispatch, AI refinement, campaign brief, promotion artifact, email slot.'
---

# Email Marketing with Sanity & Klaviyo

Build email campaigns as a **three-tier document hierarchy**:

1. **Campaign** — creative brief (goals, messaging, tone traits, personalization tokens)
2. **Promotion** — segment-variant artifact (subject, preheader, disruptor, modular slots, approval workflow)
3. **EmailSlot** — reusable content block (position, asset, headline, subheadline, CTA)

Generate N variants from one brief, refine with multi-turn AI, preview with accuracy badges, dispatch to Klaviyo. All from Studio.

## Core Principles

**Separation of concerns**: Campaign is intent (what to say, to whom, by when); promotion is execution (how to say it for each segment). Schema enforces this—campaigns have no targeting fields.

**Modular content**: EmailSlot replaces Portable Text. Enforce consistency, enable component-driven composition.

**AI-augmented not AI-native**: AI generates variants and refines copy, but humans approve every promotion before send. Thread-based refinement preserves context across turns.

**Security by design**: 7-layer defense (HTTPS+HSTS, auth 3-paths, input validation, render-time sanitization, CSP headers, rate limiting, audit logging) protects preview service and dispatch pipeline.

**Observable, not eventual**: Preview accuracy badges (X-Preview-Status) show which tokens are resolved vs. stubbed. Editors know before sending.

**Engaged audiences as default**: Segments are two-layer (synced from Klaviyo + editable enrichment for copy tone). Enrichment persists across re-syncs; it's editorial metadata, not infrastructure.

## Orientation

### Project Map

Read [references/architecture.md](references/architecture.md) for the full entry points and file structure. Key locations:

**Packages (domain logic)**

- `packages/render-email/` — MJML streaming, sanitization, stub handling (`./streaming`, `./stubs`, `./sanitize`, `./types`)
- `packages/esp-connector/` — EspConnector interface + KlaviyoConnector, payload dispatcher (`./klaviyo`, extensible to ./braze, ./ajo)
- `packages/preview-middleware/` — Composable middleware: auth, rate-limit, security-headers, logging (`./auth`, `./rate-limit`, `./security-headers`, `./logging`)
- `packages/eslint-config/`, `packages/tsconfig/`, `packages/sanity-types/` — Shared configs

**Studio (domain-organized plugins)**

- `studio/plugins/campaign/` — campaign schema, GenerateVariantsAction, CampaignGrid view, agent context
- `studio/plugins/promotion/` — promotion schema, emailSlot, VariantRefinementPanel, approval workflow
- `studio/plugins/klaviyo/` — sync UI, import trigger, readOnly origin labels
- `studio/plugins/preview/` — shareable preview links, Presentation tool wiring
- `studio/plugins/assist/` — @sanity/assist field-level generation config
- `studio/schemaTypes/reference-data/` — store, urgencyStage, segment (two-layer), brandVoice, enticement, promoCode, termsAndConditions

**Functions**

- `functions/on-promotion-approved/` — dispatch to Klaviyo when approved
- `functions/import-klaviyo/` — sync lists and segments from Klaviyo (request-document trigger)
- `functions/on-slot-needs-asset/` — notify creatives on unfilled emailSlot
- `functions/engagement-log-back/` — inbound Klaviyo webhook → patch campaignPerformance

**App SDK**

- `apps/campaign-dashboard/` — standalone (no Studio seat) campaign list and performance metrics

### Two Implementation Patterns

**Greenfield**: Start from `sanity init --template sanity-labs/starters/email-marketing`. Full three-tier model, all plugins wired.

**Brownfield**: Add email marketing to an existing Studio. See [references/add-to-existing-studio.md](references/add-to-existing-studio.md).

## Jobs to Be Done

### 1. Set up a campaign and generate variants

- Create a campaign document with: title, store, urgencyStage, segments (array of refs), primaryMessage, toneTraits, previewContext (token → sample value map), startDate, endDate
- Use GenerateVariantsAction on the campaign → creates N promotion documents (one per segment)
- Each promotion has: campaign ref, segment ref, subjectLine, preheader, disruptor, emailSlots array, campaignPerformance (readOnly)

**Entry point**: `studio/plugins/campaign/documentActions/GenerateVariantsAction.tsx` (placeholder → real agent.action.generate() call)

### 2. Refine a promotion in multi-turn loop

- Open a promotion document
- Click the VariantRefinementPanel tab (bottom pane)
- Type a refinement prompt: "Make the subject line shorter and more urgent"
- Select fields to target: subjectLine, preheader, disruptor
- Agent refines those fields; you accept/reject/modify field-by-field
- Each turn preserves prior accepted changes in the live document

**Entry point**: `studio/plugins/promotion/components/VariantRefinementPanel.tsx` (placeholder → real thread ID, agent context, field-level patching)

**Context wiring**: `studio/plugins/campaign/hooks/useAgentContext.ts` serializes:

- Supplemental: brandVoice singleton (tone traits, style rules, legal constraints)
- Local: campaign fields (primaryMessage, emotionalGoal, toneTraits) + segment enrichment (affinityDescription, typicalCopyTone, engagementTier) + previewContext tokens

### 3. Preview a promotion with accuracy badges

- Navigate to promotion in Presentation Tool or via preview link
- See `/v1/render/local/:id` for content ops (with Studio session)
- See `/v1/render/klaviyo/:id?token=...` for CRM manager (with preview token)
- Response header `X-Preview-Status` reports resolved vs. stubbed counts and accuracy %

**Rendering pipeline**:

1. Fetch promotion + campaign context
2. Build MJML from emailSlots
3. Resolve previewContext tokens (sample data)
4. Stub unresolved Klaviyo tags (fallback values)
5. Render MJML → HTML
6. Sanitize with DOMPurify (whitelist ~20 tags)
7. Return with X-Preview-Status header

**Entry point**: `packages/render-email/src/index.ts` (renderPromotionLocal, renderPromotionKlaviyo stubs)

### 4. Dispatch a promotion to Klaviyo

- Approve a promotion (workflow.state document status → approved)
- on-promotion-approved Function trigger fires
- Compose KlaviyoPayload from promotion + campaign context
- Create template in Klaviyo
- Create campaign from template, targeting segment list
- Send campaign (or schedule for later)
- Log sendId in promotion; update campaignPerformance

**Entry point**: `functions/on-promotion-approved/index.ts` (placeholder → real promotion fetch, composer, dispatcher)

**ESP pattern**: Open-closed via exports: `@starter/esp-connector/klaviyo` for Klaviyo, extend with `./braze`, `./ajo` for other ESPs. Dispatcher wraps connector with retry logic, timeout, error handling.

### 5. Sync Klaviyo audiences into Sanity

- Create a klaviyoImport document with importState = "requested"
- Trigger: import-klaviyo Function fires
- Fetch lists and segments from Klaviyo API
- Create/update segment documents: externalId (Klaviyo ID), name, type, description, memberCount (readOnly)
- CRM manager enriches each segment: affinityDescription, typicalCopyTone, engagementTier (editable layer persists across re-syncs)
- Segments appear in campaign audience targeting

**Entry point**: `functions/import-klaviyo/index.ts` (placeholder → real Klaviyo API calls, segment upserts)

### 6. Track engagement and update campaign performance

- Klaviyo sends webhook for: opened, clicked, bounced, unsubscribed
- engagement-log-back Function receives event
- Maps Klaviyo campaignId to Sanity promotion ID
- Increments campaignPerformance counters (openRate, CTR, conversionRate)
- Patches promotion document

**Entry point**: `functions/engagement-log-back/index.ts` (placeholder → real webhook verify, promotion fetch, patch)

**Dashboard**: `apps/campaign-dashboard/` queries promotions, aggregates performance by segment, shows cycle time and risk (deadline approaching).

## Security & Operations

### 7-Layer Defense for Preview Service

1. **Transport** — HTTPS only, HSTS header enforced
2. **Auth (3 paths)**
   - Studio session: browser cookie + `createStudioAgent` auth inheritance
   - Preview tokens: @sanity/preview-url-secret, time-bounded, per-link
   - Webhook signatures: Klaviyo HMAC-SHA256, timestamp validation
3. **Input validation** — Whitelist document IDs (Sanity format), enum status values
4. **Render-time** — DOMPurify sanitization, MJML validation, Handlebars syntax preserved
5. **Output headers** — CSP, X-Content-Type-Options, X-Frame-Options, Permissions-Policy, HSTS
6. **Rate limiting** — Per-IP token bucket (100 req/min default), 429 w/ Retry-After
7. **Audit logging** — Timestamp, method, path, status, IP, duration (PII redacted)

See [references/security.md](references/security.md) for threat model and configuration checklist.

### Testing Strategy

- **Unit**: MJML rendering, stub handling, sanitization, middleware composition, rate limiting
- **Integration**: Preview routes with auth, error handling, response headers
- **Load**: k6/Artillery for preview service capacity planning

See [references/testing.md](references/testing.md) for test examples.

## Customization

### Brand Voice

Replace `studio/schemaTypes/reference-data/brandVoice.ts` fields:

- toneTraits: array of tags (e.g., "authoritative", "witty", "empathetic")
- writingStyleRules: array of strings (e.g., "avoid passive voice", "use Oxford comma")
- prohibitedWords: words to avoid in generated copy
- emailGuidelines: subject line patterns, CTA vocabulary, urgency framing
- legalConstraints: required disclaimers, opt-out language

Editors maintain this singleton document in Studio. All AI generation pulls from it via `@sanity/agent-context`.

### Add New ESP (e.g., Braze)

1. Create `packages/esp-connector/src/braze/` with BrazeConnector + payload types
2. Export from `packages/esp-connector/src/index.ts`
3. Update `functions/on-promotion-approved/` to accept ESP selection (or hardcode)
4. Wire webhook handler in `functions/engagement-log-back/`

No changes to campaign, promotion, or reference-data schemas. Pattern is extensible.

### Segment Enrichment

Two-layer segments keep your sync idempotent. After importing from Klaviyo, enrichment fields persist:

- affinityDescription: free-text summary of segment behavior
- typicalCopyTone: tags (e.g., "value-conscious", "tech-savvy", "luxury-focused")
- engagementTier: enum (low, mid, high, vip)

These become part of local context for AI generation (via @sanity/agent-context). If Klaviyo updates the synced layer (name, memberCount), enrichment fields are untouched.

## References

- [references/architecture.md](references/architecture.md) — project map and file entry points
- [references/security.md](references/security.md) — 7-layer defense, threat model, config checklist
- [references/testing.md](references/testing.md) — unit/integration/load testing examples
- [references/add-to-existing-studio.md](references/add-to-existing-studio.md) — brownfield: add email marketing to existing Sanity project
- [README.md](../../README.md) — quick start, environment variables, Klaviyo API key setup
