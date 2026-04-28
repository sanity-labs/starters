# Email Marketing Operations — Architecture

## Overview

The email marketing starter implements a **three-tier content operations model** where the campaign brief (governance document) is the canonical unit of work, promotions (segment variants) are first-class artifacts that reference the brief, and email slots (modular content) enable composition without duplication.

## Three-Tier Document Model

### Campaign (The Brief)

Structured content document holding campaign intent, creative direction, audience segments, launch window, and personalization context.

**Fields:**

- `title`, `description`
- `workfrontProjectId` (upstream intake FK)
- `store` (ref), `urgencyStage` (ref)
- `segments` (array of refs to target segments)
- `startDate`, `endDate`
- `primaryMessage`, `supportingMessage` (brand positioning for this campaign)
- `valueProposition`, `emotionalGoal`, `toneTraits`
- `previewContext` (key-value map: `{ "first_name": { sample: "Jordan", description: "Recipient first name" }, ... }` — used by AI generation to ground personalized copy)
- `workflow.state` (draft, ready-for-review, approved, archived)

**Characteristics:**

- Content-about-content. Carries intent and governance state.
- Never embeds artifact content (subject lines, email copy, module content).
- Single source of truth for campaign narrative across all derived surfaces (email, web banner, landing page).

### Promotion (The Artifact)

Segment-variant artifact produced from the brief. One base promotion (no specific segment, represents the default or control group) plus one promotion per target segment.

**Fields:**

- `campaign` (ref, required) — reference back to the brief
- `segment` (ref, nullable) — for variants; null for base promotion
- `isBasePromotion` (boolean)
- `subjectLine`, `preheader`, `disruptor` (three key email header elements)
- `emailSlots` (array of structured content blocks)
- `campaignPerformance` (readOnly, populated by the engagement webhook) — `{ openRate, clickThroughRate, sendCount, errorCount }`. `conversionRate` has no source from Resend; see [`ESP-NOTES.md`](./ESP-NOTES.md).
- `workflow.state` (draft, ready-for-review, approved, sent, failed)
- `metadata.contentAgentThreadId` (internal; scopes multi-turn refinement conversations)

**Characteristics:**

- References the brief; never duplicates its content.
- Segment-aware: each variant inherits the brief's tone traits and applies segment-specific copy tone enrichment.
- Modular: composes reusable email blocks without pixel duplication.

### EmailSlot (The Module)

Reusable content block with position, asset reference, and editable text.

**Fields:**

- `position` (enum: hero, cta, footer, etc.)
- `asset` (ref to DAM — AEM Dynamic Media, Cloudinary, etc.) — stores pixel data
- `headline`, `subheadline`, `cta` (text)
- `ctaUrl` (destination)

**Characteristics:**

- DAM reference keeps pixel data out of Sanity; Sanity carries the composition.
- Reused across promotions; changes to the asset update all references automatically.

### Reference Data

- **Segment** (two-layer schema)
  - ReadOnly synced from Resend: `externalId` (Resend segment ID), `name`, `memberCount`, `lastSyncedAt`
  - Editable enrichment: `affinityDescription`, `typicalCopyTone` (["urgent", "exclusive", ...]), `engagementTier` (high, medium, low)
  - Segment-specific tone enrichment persists across re-syncs.
  - Resend Segments are static lists — there is no behavioral/dynamic segment API. See [`ESP-NOTES.md`](./ESP-NOTES.md).

- **Store**, **UrgencyStage**, **Enticement** — governance reference data for campaign configuration
- **BrandVoice** (singleton) — style rules, prohibited words, email guidelines (used by Content Agent API context injection)
- **TermsAndConditions**, **PromoCode** — campaign-scoped legal and offer data

## Content Operations Workflows

### Workflow 1: Generate Variants (Batch)

1. Content ops lead fills in campaign brief (messaging, segments, launch window).
2. Clicks "Generate variants" document action on `campaign`.
3. Content Agent API receives:
   - Brief context: `primaryMessage`, `toneTraits`, `emotionalGoal`, `previewContext`
   - Segment list with segment-specific copy tone
   - Brand voice guidelines
4. For each target segment: **one-shot** generation creates one promotion document (copy fields only: `subjectLine`, `preheader`, `disruptor`).
5. Promotion documents created with `_id` pattern `promotion-{campaignId}-{segmentId}` or auto-generated.

**Note:** `client.agent.action.generate()` is stateless and one-shot — each segment generation is independent.

### Workflow 2: Refine Variant (Multi-Turn)

1. Content ops lead opens a promotion document.
2. Clicks "Refine" → opens **Conversation Inspector** panel.
3. Panel initializes or fetches an existing thread (scoped to this promotion).
4. Lead enters free-text prompt: _"Make the tone more urgent."_
5. `content-agent` headless service:
   - Fetches current promotion state (all fields)
   - Fetches campaign brief + segment profile + brand voice
   - Sends user message + full context to the model
   - Streams response back to the panel
6. Panel renders suggestions as side-by-side cards (old value vs. suggested value).
7. Lead accepts, edits, or rejects each suggestion.
8. Accepted suggestions auto-patch the promotion document (field-level update).
9. Lead can send another message in the same thread — agent sees prior edits and full context.
10. Thread persists; can be reopened anytime.

**Thread persistence:** Stored in `promotion.metadata.contentAgentThreadId`. Thread ID scoped per promotion, per organization.

**Auth:** Uses `createStudioAgent(client, workspace)` — browser's Studio OAuth session (`credentials: 'include'`).

### Workflow 3: Grid Review

1. All promotions (base + segment variants) appear in `<CampaignGrid>` Structure Builder view as a grid of tiles.
2. Each tile renders a local react-email preview (no external calls).
3. Tiles re-render on every campaign-level edit (brief change → all variants re-evaluate context).
4. Lead spot-checks subject lines, preheaders, and module content across variants.
5. Can dive into individual promotion for refinement (Workflow 2) or approve state transition.

### Workflow 4: Preview and Share

1. Lead or reviewer opens a promotion.
2. Preview tab renders the email HTML locally via `@react-email/render` (Resend has no server-side render API).
3. Lead generates a shareable preview link (signed token via `@sanity/preview-url-secret`).
4. External reviewer (no Studio account) opens the link in a browser.
5. Preview shows:
   - Rendered email HTML
   - Personalization tokens resolved to sample data from `campaign.previewContext`
   - Styled stubs for Resend send-time tags (e.g., `{{{RESEND_UNSUBSCRIBE_URL}}}`)
   - `X-Preview-Status: local-render` response header indicating preview was generated locally
6. Reviewer adds inline comments (Studio comment thread); lead resolves in Studio.

### Workflow 5: Approve and Dispatch

1. Lead triggers approval state transition on promotion (`workflow.state: "approved"`).
2. `on-promotion-approved` Function fires:
   - Fetches promotion + campaign + segment context
   - Builds email HTML via `buildHtml(promotion)`
   - Calls `resend.broadcasts.create({segmentId, from, subject, html})`
   - Calls `resend.broadcasts.send(broadcastId)`
   - Writes returned `broadcast.id` back to the promotion as `externalCampaignId`
3. Resend delivers the broadcast to all contacts in the targeted Segment.
4. Send happens in Resend.

### Workflow 5b: Scheduled Resend segment sync

Background sync of Resend segments, no manual click required.

1. `scheduled-import-resend-segments` Function fires on cron (`every 5 minutes`).
2. Function reads the `espImport` singleton; if `importState` is `idle`, `imported`, or `error`, it patches it to `"requested"`.
3. Patch triggers the existing `import-resend-segments` document Function (delta filter on `importState == "requested"`), which performs the actual Resend API calls.
4. If `importState` is already `requested` or `importing`, the scheduled run is a no-op (skip log).
5. Studio surfaces sync state via the `LastSyncedBadge` on the `espImport` document — shows "Syncing…", "Sync failed", or "Synced N min ago".

**Auth model:**

- `defineRobotToken` in `sanity.blueprint.ts` provisions an editor-scoped robot for the project.
- The robot token is referenced from the function via `robotToken: '$.resources.email-marketing-robot.token'` and arrives at runtime as `context.clientOptions.token`.
- Project ID and dataset are not auto-populated for scheduled functions (no triggering document context). They are read from `process.env.SANITY_STUDIO_PROJECT_ID` and `process.env.SANITY_STUDIO_DATASET`, injected via the blueprint's `env: {...}` block (sourced from the root `.env` at deploy time using `dotenv/config`).

### Workflow 6: Engagement log-back from Resend webhooks (Svix)

1. Resend webhook fires on engagement events (`email.opened`, `email.clicked`, `email.bounced`, `email.delivered`, `email.complained`).
2. The Next.js route `frontend/app/api/webhooks/engagement/route.ts`:
   - Verifies the Svix signature on the raw body via `resend.webhooks.verify({payload, headers, webhookSecret})`. Headers: `svix-id`, `svix-timestamp`, `svix-signature`.
   - Looks up the promotion via `broadcast_id` → `externalCampaignId`.
   - Increments `promotion.campaignPerformance` counters:
     - `email.opened` → `openRate++`
     - `email.clicked` → `clickThroughRate++`
     - `email.bounced` → bounce log only (no field today)
3. Campaign dashboard queries `campaignPerformance` to show:
   - Cycle time (intake → approved)
   - Variant coverage
   - Per-variant engagement deltas (open rate vs. base, CTR vs. base, etc.)

There is no Resend equivalent for Klaviyo's `Placed Order` metric event, so `conversionRate` has no source. See [`ESP-NOTES.md`](./ESP-NOTES.md) for guidance on wiring it from an external CDP/analytics source if needed.

## Package Architecture

Shared packages live in `packages/` under the `@starter/` npm scope.

### `@starter/render-email` (at `packages/render-email/`)

Pure, platform-agnostic email rendering.

**Responsibilities:**

- React Email components → HTML via `@react-email/render`
- DOMPurify sanitization with email-safe config
- Merge-tag stub replacement for preview (resolves `{{ first_name }}` from `previewContext`; styles `{{{RESEND_UNSUBSCRIBE_URL}}}` as a chip)

**Key exports:**

- `renderPromotion(promotion, previewContext)` → HTML string
- `stubResendTags(html)` — replaces unresolved Resend merge tags with styled placeholders for preview
- `sanitizeEmailHtml(html)` — DOMPurify with email-safe config

### Sanity Functions

There is no shared ESP connector package. Each function calls the Resend Node SDK directly.

- `functions/on-promotion-approved/` — uses `new Resend(apiKey).broadcasts.create()` + `.broadcasts.send()`
- `functions/import-resend-segments/` — uses `resend.segments.list()` + `resend.contacts.list({segmentId})`
- `functions/scheduled-import-resend-segments/` — cron trigger; just flips `espImport.importState` to `"requested"`

To swap to a different ESP, replace the SDK calls in those three locations. The schema (`externalId`, `externalCampaignId`) is already ESP-agnostic.

## AI & Content Generation

### Batch Generation (Content Agent API)

**Trigger:** "Generate variants" document action on `campaign`.

**Context injection (automatic):**

```
System prompt:
─────────────

You are a promotional email content writer.

## Campaign Brief

Title: ${campaign.title}
Primary Message: ${campaign.primaryMessage}
Emotional Goal: ${campaign.emotionalGoal}
Tone Traits: ${campaign.toneTraits.join(', ')}

## Segment

Name: ${segment.name}
Affinity: ${segment.affinityDescription}
Copy Tone: ${segment.typicalCopyTone.join(', ')}

## Brand Voice

Prohibited Words: ${brandVoice.prohibitedWords.join(', ')}
Email Guidelines: ${brandVoice.emailGuidelines}

---

Generate exactly one promotion: {
  "subjectLine": "<18-25 chars>",
  "preheader": "<50-80 chars>",
  "disruptor": "<emoji + short copy>"
}
```

**Output:** New promotion document with generated copy fields.

### Multi-Turn Refinement (Content-Agent)

**Trigger:** "Refine" button on promotion → opens Conversation Inspector.

**Architecture:**

- Studio panel calls `content-agent` HTTP API
- `content-agent` manages thread state (persistent messages)
- On each user message, content-agent fetches full context (promotion, campaign, segment, brand voice) and sends to model
- Model responds with suggestions + reasoning
- Panel renders accept/reject UI
- Accepted changes patch the promotion document live

**Key difference from batch:** Multi-turn, stateful, context carries forward across turns.

## Preview Service

The Next.js frontend renders email HTML locally via `@react-email/render`. Resend has no server-side render API — there is no roundtrip to the ESP for preview.

| Mode                  | Consumer                      | Input                          | Auth                         | Output                                      |
| :-------------------- | :---------------------------- | :----------------------------- | :--------------------------- | :------------------------------------------ |
| Grid tile             | Studio Structure Builder      | Batch of promotion IDs via SSE | Studio OAuth                 | Local react-email render per tile           |
| 1:1 preview           | Content ops lead              | Single promotion ID            | Studio OAuth + preview token | Local react-email render                    |
| Shareable review link | External reviewer (no Studio) | Promotion ID + signed token    | Time-boxed PASETO/JWT        | Local react-email render embedded in iframe |

**Pipeline:**

```
render(<PromotionEmail promotion={promotion}/>)
  → DOMPurify sanitize
  → stubResendTags()           // styles unresolved merge tags
  → response.body
```

**Stub tiers:**

1. **Resolved from `campaign.previewContext`** — `{{ first_name }}`, `{{ order.total }}` → sample values
2. **Styled stubs for Resend tags** — `{{{RESEND_UNSUBSCRIBE_URL}}}` → styled chip placeholder ("Resolves at send time")
3. **Fallback** — unresolved `{{ var }}` → generic stub

**Response header:**

```
X-Preview-Status: local-render
```

This indicates the preview was generated locally rather than via a (non-existent) ESP render API.

## Integrations

### Resend Segment Sync

Document and scheduled Functions:

1. `scheduled-import-resend-segments` runs every 5 minutes; flips `espImport.importState` to `"requested"`.
2. `import-resend-segments` (triggered by the patch) calls `resend.segments.list()` and, per segment, `resend.contacts.list({segmentId})` for `memberCount`.
3. For each segment: creates or updates the readOnly fields on the `segment` document with `{ externalId, name, memberCount }`.
4. Editable enrichment fields (`affinityDescription`, `typicalCopyTone`, `engagementTier`) are preserved across re-syncs via partial patch — sync never overwrites the enrichment layer.

### Engagement Webhook (Svix)

Inbound webhook from Resend to `frontend/app/api/webhooks/engagement/route.ts`:

1. Route receives webhook event.
2. Verifies the Svix signature on the raw body via `resend.webhooks.verify({payload, headers, webhookSecret})`.
3. Looks up promotion via `broadcast_id` → `externalCampaignId`.
4. Updates `promotion.campaignPerformance`:
   ```javascript
   {
     openRate: (opens / sends),
     clickThroughRate: (clicks / opens),
     sendCount: N,
     errorCount: E,
     lastUpdatedAt: now()
   }
   ```
5. Campaign dashboard queries these fields to show engagement deltas.

### Content Releases

Multi-promotion scheduling:

1. Lead bundles all approved promotions into a Content Release.
2. Sets release date/time.
3. On release trigger: each promotion publishes, firing `on-promotion-approved` Function in parallel.
4. All variants send at the same moment.

## Security Posture

Seven layers of defense for preview and dispatch:

1. **Transport** — HTTPS + HSTS (2-year max-age, preload, includeSubDomains)
2. **Auth (3 paths, no fallback)**
   - Studio OAuth (browser session)
   - Preview token (signed PASETO/JWT ES256, scoped to `{docId, embeddingOrigin, exp, jti}`)
   - Webhook signature (Svix verification on raw body via `resend.webhooks.verify(...)`; headers: `svix-id`, `svix-timestamp`, `svix-signature`)
3. **Input validation** — Zod schemas, document ID whitelist (`[a-zA-Z0-9._-]{1,64}`), enum enforcement
4. **Render-time**
   - SSRF prevention (allow-list: `cdn.sanity.io` and configured DAM origins; block metadata endpoints)
   - HTML sanitization (DOMPurify with email config)
   - Merge-tag syntax preserved (not eval'd)
5. **Output headers** (every response)
   - CSP: `default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https:; frame-ancestors [dynamic per token]`
   - X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, CORS
6. **Rate limiting** (three tiers)
   - Per-IP: 60 req/min global
   - Per-token: 10 renders/min
   - Per-document: Coalesce concurrent requests (cache key: `(endpoint, docId, contentHash)`)
7. **Audit logging** (structured)
   - Timestamp, method, path, status, IP, duration
   - Redact: auth header, signature, tokens, PII from previewContext

See [SECURITY.md](./SECURITY.md) for threat model and configuration checklist.
