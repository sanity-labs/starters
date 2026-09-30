---
name: email-marketing-ops
description: 'Build multi-variant email campaigns with AI, streaming preview, and Klaviyo dispatch. Covers three-tier document model (campaign brief → promotion artifact → email slot), batch variant generation, multi-turn refinement, @sanity/context wiring, preview accuracy badges, security (7-layer defense), and engagement feedback. Supports both greenfield (new Sanity studio) and brownfield (adding to existing) patterns. Trigger on: email marketing, variant generation, campaign dashboard, Klaviyo sync, preview service, engagement metrics, segment enrichment, email dispatch, AI refinement, campaign brief, promotion artifact, email slot.'
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

**Security by design**: authored content is escaped at render time in both the preview renderer and the send Function (`@starter/render-email/escape`), previews are DOMPurify-sanitized as a whole document and served with a strict CSP, and the preview route is gated by `SANITY_PREVIEW_SECRET`, which is required in production. See `docs/SECURITY.md` for what is and is not implemented before adding controls.

**Observable, not eventual**: Preview accuracy badges (X-Preview-Status) show which tokens are resolved vs. stubbed. Editors know before sending.

**Engaged audiences as default**: Segments are two-layer (synced from Klaviyo + editable enrichment for copy tone). Enrichment persists across re-syncs; it's editorial metadata, not infrastructure.

## Orientation

### Project Map

Read [references/architecture.md](references/architecture.md) for the full entry points and file structure. Key locations:

**Packages (domain logic)**

- `packages/render-email/` — MJML rendering, whole-document sanitization, escaping helpers, stub handling (`.`, `./sanitize`, `./escape`, `./stubs`, `./streaming`, `./types`)
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

**Context wiring**: `studio/plugins/campaign/hooks/useSanityContext.ts` serializes:

- Supplemental: brandVoice singleton (tone traits, style rules, legal constraints)
- Local: campaign fields (primaryMessage, emotionalGoal, toneTraits) + segment enrichment (affinityDescription, typicalCopyTone, engagementTier) + previewContext tokens

### 3. Preview a promotion with accuracy badges

- Navigate to promotion in Presentation Tool or via preview link
- See `/v1/render/local/:id` for content ops (with Studio session)
- See `/v1/render/klaviyo/:id?token=...` for CRM manager (with preview token)
- Response header `X-Preview-Status` reports resolved vs. stubbed counts and accuracy %

**Rendering pipeline**:

1. Verify `SANITY_PREVIEW_SECRET` (fails closed in production when unset)
2. Fetch promotion + campaign context (GROQ `$id` parameter)
3. Build MJML from emailSlots, escaping every field and dropping non-http(s) URLs
4. Render MJML → HTML; optionally round-trip through Klaviyo's template render API to resolve sample tokens
5. Sanitize the whole document once with DOMPurify (`sanitizeEmailHtml`)
6. Return with X-Preview-Status header and strict CSP headers

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

### Security Controls That Exist

1. **Output escaping** — `escapeHtml` + `safeHttpUrl` on every interpolated value, in the MJML renderer and in `functions/on-promotion-approved/`
2. **Preview sanitization** — `sanitizeEmailHtml` (DOMPurify, whole document) before the preview route responds
3. **Preview auth** — shared `SANITY_PREVIEW_SECRET`, constant-time compare, fails closed in production
4. **Output headers** — CSP `default-src 'none'`, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, Permissions-Policy
5. **Webhook signatures** — Klaviyo HMAC-SHA256 with timestamp window when `KLAVIYO_WEBHOOK_SECRET` is set (fails open when unset)

Not implemented: per-link expiring preview tokens, Studio OAuth on the preview route, SSRF host allow-listing, rate limiting, audit logging. When you add a field that is interpolated into HTML, route it through `@starter/render-email/escape` in every renderer.

See [docs/SECURITY.md](../../docs/SECURITY.md) for the threat model and configuration checklist.

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

Editors maintain this singleton document in Studio. All AI generation pulls from it via `@sanity/context`.

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

These become part of local context for AI generation (via @sanity/context). If Klaviyo updates the synced layer (name, memberCount), enrichment fields are untouched.

## References

- [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) — project map and file entry points
- [docs/SECURITY.md](../../docs/SECURITY.md) — implemented controls, threat model, config checklist
- [docs/TESTING.md](../../docs/TESTING.md) — unit/integration/load testing examples
- [references/add-to-existing-studio.md](references/add-to-existing-studio.md) — brownfield: add email marketing to existing Sanity project
- [README.md](../../README.md) — quick start, environment variables, Klaviyo API key setup
