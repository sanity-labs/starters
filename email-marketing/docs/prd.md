# Email Marketing Operations — Product Requirements Document

## Problem Statement

Marketing operations teams rebuild campaign artifacts from scratch every cycle. Campaign intent (brief), asset references, localization, segment variants, and brand governance live in separate systems (project tools, ESPs, figma, docs), with no single source of truth. This forces:

- **Content duplication**: subject lines, disclaimers, product details copy-pasted across segments and surfaces, drifting independently
- **Review friction**: approvals tracked across Slack threads, Figma comments, and spreadsheets; no version control or audit trail
- **Slow iterations**: changes to product info, disclaimers, or new segments require hunting down every scheduled artifact
- **Integration opacity**: the ESP template builder is a black box; no preview, no composition auditing, no content-authorship workflow primitives
- **Missed performance feedback**: engagement signal (opens, clicks, conversions) doesn't flow back to inform the next campaign cycle

Teams perceive this as inevitable — "that's just how email works." They solve it by hiring specialized marketing ops roles to manage the duplication, spreadsheets, and manual escalations. But they're symptom-managing, not fixing the root: no governed content layer between brief and ESP.

## Solution

**Sanity becomes the campaign content operations layer.** The brief is the governed unit of work; all derived artifacts (email variants, web banners, landing pages) inherit from it by reference. AI generation is grounded in the brief intent and segment profiles, not a vendor black box. Variants exist as first-class content, not duplicates. Review, commenting, versioning, scheduling, and performance feedback use the same tools the site already uses. The ESP keeps what it's good at — segmentation, orchestration, deliverability — and receives a clean, validated payload per variant at approval.

Architecturally:

- **Three-tier document model**: brief (`campaign`) → artifact (`promotion`) → modular content (`emailSlot`). Variants branch from the brief; each segment-variant promotion inherits intent by reference.
- **AI as content operations, not automation**: Content Agent API drives one-shot batch generation (one brief → N variants) and multi-turn refinement (iterative tuning for a specific segment). Agent Context injects brief, segment, and brand voice context so generation is grounded, not speculative.
- **ESP-agnostic send layer**: A Sanity Function dispatches approved content to any ESP via a pluggable payload composer interface. Klaviyo is the default; swapping to Braze or AJO requires adding an ESP module, not rewriting the integration boundary.
- **Streaming preview fidelity**: A preview service renders MJML → handles Klaviyo send-time stubs (personalization tokens) → streams the result back with accuracy metadata so reviewers know what's dynamic vs. live.
- **Performance feedback loop**: Engagement signal (opens, clicks, conversions) flows back from the ESP to populate `campaignPerformance` fields on each variant, grounding the next cycle's AI context.

## User Stories

### Content Operations Lead

1. As a content ops lead, I want to create a campaign brief in Studio with messaging intent, audience segments, and urgency stage, so that I have a single structured source of truth for the promotion.

2. As a content ops lead, I want to run a "Generate variants" document action on the brief, so that Content Agent API creates one base promotion plus one segment-variant promotion per target segment in a single batch.

3. As a content ops lead, I want the generated promotions to be grounded in the brief's messaging intent + the segment's copy tone, so that variants are tonally appropriate without manual rewriting.

4. As a content ops lead, I want to see all variant promotions side-by-side in a `<CampaignGrid>` Structure Builder view with local MJML renders, so that I can spot-check subject lines, preheaders, and slot content across variants quickly.

5. As a content ops lead, I want to enter a multi-turn refinement session on a specific promotion, so that I can iteratively tune a variant if the tone is off, the subject line is too long, or the disruptor doesn't land.

6. As a content ops lead, I want each refinement message to see the current promotion state and campaign context, so that the agent reasons over what's already been written and what changes are already accepted.

7. As a content ops lead, I want refinement changes to accumulate in the live promotion document, so that I don't have to manually apply suggested edits.

8. As a content ops lead, I want to share a preview link (containing a rendered email) with legal and brand stakeholders, so that reviewers can see the exact look-and-feel without needing a Studio seat.

9. As a content ops lead, I want the preview to show personalization tokens ({{first_name}}, {{last_purchase_date}}) resolved to sample data, so that reviewers understand the final look when sent.

10. As a content ops lead, I want the preview to clearly indicate which fields are send-time-only (Klaviyo {{coupon_code}}) vs. resolved at preview time, so that reviewers aren't confused about what's dynamic.

11. As a content ops lead, I want to trigger approval on a promotion, so that a state-machine transition fires and an approval Function dispatches the content to the ESP.

12. As a content ops lead, I want to view the campaign performance dashboard after send, so that I can see cycle time, variant coverage (approved promotions / total segments), and engagement deltas (open rate, CTR, conversion vs. base variant).

13. As a content ops lead, I want to schedule a coordinated release across all approved promotions, so that all variants send at the same moment via Content Releases.

### Integration Engineer

1. As an integration engineer, I want to configure a Function on promotion approval events, so that the send logic is decoupled from the Studio UI.

2. As an integration engineer, I want to write an ESP-specific payload composer (e.g., `composeKlaviyoPayload()`) as a standalone utility package, so that the composer is testable outside the Function runtime.

3. As an integration engineer, I want the payload composer to conform to an `EspConnector<TPayload>` interface, so that swapping ESPs requires writing a new composer, not rewriting the Function.

4. As an integration engineer, I want to add Braze or AJO support, so that I can swap ESPs by adding a new module under `@starter/esp-connector` without touching existing Klaviyo code.

5. As an integration engineer, I want the preview service to call Klaviyo's `/api/template-render/` endpoint to verify how send-time tags are resolved, so that I know the Sanity preview matches what Klaviyo will render.

6. As an integration engineer, I want the preview service to sanitize HTML and handle SSRF attacks, so that I can safely render Sanity-authored content before posting to Klaviyo.

7. As an integration engineer, I want rate limiting and auth on preview endpoints, so that the service doesn't get abused and doesn't expose content to unauthenticated users.

8. As an integration engineer, I want structured audit logging with PII redaction, so that I can debug send failures and compliance audits without exposing user email addresses.

9. As an integration engineer, I want engagement data (opens, clicks, conversions) to POST back to a Sanity Function via ESP webhook, so that I can write metrics to the promotion's `campaignPerformance` field.

### CRM / Lifecycle Manager

1. As a CRM manager, I want segment documents to be synced into Sanity from our CDP via a scheduled Function, so that generated variants are grounded in actual audience definitions.

2. As a CRM manager, I want to enrich synced segments with copy-tone context (affinityDescription, typicalCopyTone, engagementTier), so that Content Agent API generation is audience-aware, not generic.

3. As a CRM manager, I want the copy-tone enrichment to persist across re-syncs, so that I don't have to re-author it every time the segment definition updates in the CDP.

4. As a CRM manager, I want to trigger ad-hoc generation if a new segment emerges after the initial "Generate variants" batch, so that I can generate one additional promotion for that segment without re-running the full batch.

5. As a CRM manager, I want to see the variant promotions with their segment-specific messaging before approving send, so that I can confirm the tone and content match the audience.

6. As a CRM manager, I want the ESP payload to include the segment's CDP segment ID, so that I can configure journeys and triggers in the ESP referencing the Sanity-authored content.

7. As a CRM manager, I want engagement metrics to flow back from the ESP, so that I can observe segment-level performance in the campaign dashboard.

### Customer-Side Product Manager (PM Champion)

1. As a PM champion, I want a campaign performance dashboard (standalone App SDK app, no Studio seat required), so that I can show ROI to exec sponsors without distributing Studio access.

2. As a PM champion, I want the dashboard to surface cycle time (intake → approved), so that I can measure velocity improvements quarter-over-quarter.

3. As a PM champion, I want the dashboard to show variant coverage (approved promotions / total target segments per campaign), so that I can flag campaigns where variants are incomplete or delayed.

4. As a PM champion, I want to see per-variant engagement deltas (open rate, CTR, conversion vs. base variant), so that I can identify which segment-specific tones and content variations perform best.

5. As a PM champion, I want to see campaigns approaching their end date, so that I can flag at-risk launches to the content ops team.

6. As a PM champion, I want a Studio tool link to the same dashboard, so that content ops leads can quickly jump to performance insights without leaving Studio.

## Implementation Decisions

### Package Architecture

All domain packages live under `packages/` with `@starter/` npm scope. Each package is independently versionable, treeshakable, and adheres to open-closed principle (adding ESPs or middleware = new subpath exports, never modification of existing interfaces).

**`@starter/render-email`**

- **Purpose**: Platform-agnostic MJML rendering, streaming, sanitization, and Klaviyo stub replacement.
- **Exports**:
  - `.` — `renderPromotionLocal(promotion, previewContext): string` (local MJML render for preview grid)
  - `./streaming` — `renderMjmlStream(mjml): ReadableStream`, `StubReplacerStream` (Readable stream transform), `sanitizeStream` (dompurify sanitizer), `streamToString(stream): Promise<string>`
  - `./stubs` — `stubKlaviyoTags(html): html`, `resolvePreviewContext(promotion, previewData): resolved`, `buildPreviewStatus(promotion): metadata`
  - `./sanitize` — `createEmailSanitizer(options): sanitizer` (dompurify wrapper)
  - `./types` — `RenderAdapter`, `RenderContext`, `PreviewStatus`
- **Internal imports** (`#`): `#types`, `#utils` (no deep relative paths; internal cross-file refs use imports field)
- **Open-closed**: New render targets (e.g., a React Email adapter) add new subpath exports; core render functions never change.
- **Tree-shaking**: MJML and dompurify are imported only in their respective subpaths, so consumers importing only `./types` or `.` pay no runtime cost for heavy dependencies.

**`@starter/esp-connector`**

- **Purpose**: ESP-agnostic payload composition interface with per-ESP implementations.
- **Core interface**:
  ```typescript
  interface EspConnector<TPayload> {
    compose(input: ComposerInput): TPayload
    dispatch(payload: TPayload, adapter: DispatchAdapter): Promise<void>
  }
  ```
- **Exports**:
  - `.` — `EspConnector<T>`, `createPayloadDispatcher(config)`, `ComposerInput`, `DispatchAdapter`
  - `./klaviyo` — `KlaviyoConnector`, `KlaviyoPayload`, usage of Klaviyo v2025-07-15 API
  - `./types` — All TS interfaces
- **Open-closed**: Adding Braze support = writing `./braze` with `BrazeConnector` export; existing Klaviyo code untouched.
- **Usage in Functions**: The `on-promotion-approved` Function receives a promotion, calls `espConnector.compose(input)` to build the ESP-specific payload, then calls `espConnector.dispatch(payload, adapter)` to POST to the ESP.

**`@starter/preview-middleware`**

- **Purpose**: Composable auth, rate limiting, security headers, and audit logging for the preview service.
- **Middleware type**: `(req: Request, next: () => Promise<Response>) => Promise<Response>` (chain-of-responsibility pattern).
- **Exports**:
  - `.` — `composeMiddleware(middlewareFns): composed`, `Middleware<T>` type
  - `./auth` — `studioSessionMiddleware(options)`, `previewUrlSecretMiddleware(secret)`, `espWebhookMiddleware(sigVerifier)`
  - `./rate-limit` — `rateLimitMiddleware(options)` (per-IP or per-token, configurable backend: Redis/in-memory)
  - `./security-headers` — `buildCspHeader(options)`, `SECURITY_HEADERS` (constant object with CSP, X-Frame-Options, X-Content-Type-Options, etc.) — **ZERO runtime dependencies**
  - `./logging` — `auditLoggingMiddleware(logger)` (structured logging with PII redaction patterns)
  - `./types` — Middleware, Context types
- **Tree-shaking**: `./security-headers` is a pure data subpath with no imports from other subpaths; bundlers tree-shake independently. A consumer that only needs headers imports `@starter/preview-middleware/security-headers` without pulling in rate-limit or auth logic.

### Studio Plugin Organization

Domain plugins live under `studio/plugins/` and own their schema, document actions, and UI components. Not feature-organized (e.g., "AI", "workflow") but domain-organized (e.g., "campaign", "promotion").

**`studio/plugins/campaign/`**

- **Schema**: `campaign.ts` — brief intent, audience, timing, tone traits, urgency stage, store, segments (array of refs)
- **Document actions**:
  - "Generate variants" — calls `client.agent.action.generate()` per selected segment; creates base + N segment-variant promotions + companion workflow.state docs
  - Multi-turn refinement UI accessible via promotion detail (moved to promotion plugin; triggered from campaign context)
- **Views**: `<CampaignGrid>` Structure Builder view — custom view on campaign document pane showing all variant promotions side-by-side as Shadow DOM tiles with local MJML renders
- **Agent Context wiring**: Campaign document is configured as context source for `@sanity/agent-context` (brief fields + brand voice + segment profiles + previewContext)

**`studio/plugins/promotion/`**

- **Schema**: `promotion.ts` — campaign ref, segment ref (nullable for base), isBasePromotion, subjectLine, preheader, disruptor, emailSlots array, campaignPerformance (readOnly)
- **Schema**: `emailSlot.ts` object type — position enum (top-banner | module-1 | module-2), asset (aemAsset ref), headline, subheadline, cta (text + url)
- **Document actions**:
  - "Approve" — transitions workflow.state to approved; fires on-promotion-approved Function
  - "Resend" — admin action to manually re-trigger send
  - "Multi-turn refinement panel" — text input for iterative refinement; calls `client.agent.action.generate()` targeting specific fields (subjectLine, preheader, disruptor, emailSlots); uses `createStudioAgent(client, workspace)` for auth inheritance
- **Document badges**: Workflow state (Draft | In Review | Approved | Sent) + segment name tag
- **Workflow state docs**: Parallel `workflow.state` documents created by "Generate variants" action; no embedded status fields on promotion

**`studio/plugins/klaviyo/`**

- **Schema**: `list.ts`, `segment.ts` (two-layer: readOnly synced + editable enrichment), `klaviyoImport.ts` (state tracking)
- **Document actions**:
  - "Import from Klaviyo" — invokes import-klaviyo Function
  - "Open in Klaviyo" — link to external Klaviyo UI
- **Document descriptions**: "Managed in Klaviyo" origin badge on read-only fields
- **Logic**: import-klaviyo Function handles paginated sync, transaction-batched upserts/deletes, state machine tracking

**`studio/plugins/preview/`**

- **Schema**: none (utilities only)
- **Document actions**: none (preview URLs shared out-of-band)
- **Logic**: Shareable preview URL generation via `@sanity/preview-url-secret`, deep linking to preview service `/v1/render/local/:id` (content ops) vs. `/v1/render/klaviyo/:id` (CRM manager verification)
- **Presentation tool wiring**: configures Studio's Presentation Tool to point at preview service

**`studio/plugins/assist/`**

- **Purpose**: Field-level AI generation configuration using `@sanity/assist`
- **Fields enabled**: `subjectLine`, `preheader`, `disruptor`, `emailSlot.headline`, `emailSlot.subheadline`
- **Behavior**: Inline assist button on each field, generating suggestions; user accepts/modifies/rejects inline

**`studio/schemaTypes/reference-data/`**

- Shared reference types: `store`, `urgencyStage`, `enticement`, `promoCode`, `termsAndConditions`, `brandVoice` (singleton)

### Document Model & Content Schema

**`campaign` (the brief)**

- `title` (required)
- `store` (reference → store)
- `segments` (array of references → segment)
- `startDate`, `endDate` (date)
- `primaryMessage`, `supportingMessage`, `valueProposition` (multi-line text)
- `emotionalGoal` (string, e.g. "FOMO", "excitement")
- `toneTraits` (array of tags, e.g. ["urgent", "aspirational", "playful"])
- `previewContext` (key-value map: `{ first_name: { sample: "Sarah", description: "subscriber first name" }, last_purchase_date: { sample: "2026-03-15", description: "date of most recent order" } }`)

**`promotion` (the artifact)**

- `campaign` (reference → campaign, required)
- `segment` (reference → segment, nullable for base promotion)
- `isBasePromotion` (boolean)
- `subjectLine` (string, max 60, `@sanity/assist` enabled)
- `preheader` (string, max 90, `@sanity/assist` enabled)
- `disruptor` (string, max 3 words, `@sanity/assist` enabled)
- `emailSlots` (array of `emailSlot` objects)
- `campaignPerformance` (readOnly object: `{ openRate?: number, clickThroughRate?: number, conversionRate?: number, notes?: string }`)
- Workflow state is a **parallel document** (`workflow.state`), not an embedded field

**`segment` (two-layer)**

- **ReadOnly synced layer** (populated by import-klaviyo Function, never edited):
  - `externalId` (Klaviyo segment ID)
  - `name`
  - `type` (list | behavioral)
  - `description` (Klaviyo's definition)
  - `memberCount`
- **Editable enrichment layer** (authored by CRM manager after sync):
  - `affinityDescription` (plain text, e.g. "High-value repeat customers who bought jewelry in Q4")
  - `typicalCopyTone` (tags: "luxury", "aspirational", "FOMO-driven", etc.)
  - `engagementTier` (enum: low | mid | high | vip)
  - `notes`

**`brandVoice` (singleton, supplemental context for Agent Context)**

- `toneTraits` (array of brand-level tags, e.g. ["inclusive", "irreverent", "data-backed"])
- `writingStyleRules` (Portable Text: "always use Oxford comma", "avoid passive voice", "use imperatives for CTAs")
- `prohibitedWords` (array: "unfortunately", "please", "thanks")
- `emailGuidelines` (Portable Text: subject line patterns, CTA vocabulary, urgency framing rules)
- `legalConstraints` (Portable Text: opt-out language, CAN-SPAM rules)

### AI & Content Agent Integration

**Batch generation** (one brief → N variants)

- Document action "Generate variants" on `campaign`
- User selects target segments (or defaults to all campaign.segments)
- For each segment: calls `client.agent.action.generate()` with:
  - Campaign context (brief fields, emotionalGoal, toneTraits, previewContext)
  - Segment context (affinityDescription, typicalCopyTone, engagementTier)
  - Brand context (brandVoice singleton, serialized via Agent Context on campaign)
  - System prompt: "Generate a promotional email for the {{segmentName}} audience. Tone: {{typicalCopyTone}}. Include personalization tokens: {{availableTokens}}."
- Action creates one `promotion` document per segment + companion `workflow.state` docs

**Multi-turn refinement** (iterative tuning for a specific variant)

- Component `<VariantRefinementPanel>` on promotion document detail
- User enters free-text prompt: "This tone is too harsh for the segment. Make it more aspirational."
- Panel calls `client.agent.action.generate()` targeting specific fields (subjectLine, preheader, disruptor, or all)
- Agent sees:
  - Campaign context (brief + segment profile)
  - Current promotion state (all fields as they exist)
  - Prior accepted changes (accumulated in the live document)
  - User's refinement request
- Result: field-level suggestions (one per line); user accepts/modifies/rejects each
- Accepted changes auto-update the live promotion document
- Uses `createStudioAgent(client, workspace)` (v0.6.0+) for Studio session auth inheritance; no explicit token in browser

**No manual prompt assembly**: All context injection is declarative via `@sanity/agent-context` on `campaign` document. Schema change to add a field to campaign automatically includes it in the context — no code changes to prompt assembly logic.

**Personalization awareness**: `campaign.previewContext` is serialized as context, so Content Agent API generation understands available tokens ({{first_name}}, {{last_purchase_date}}) and incorporates them naturally in generated copy, not treating them as opaque syntax.

### Audience Source: Klaviyo-Synced Segments

**Default assumption**: For mid-market B2C, Klaviyo IS the CDP. Segments are synced from Klaviyo into Sanity via scheduled Function.

**Two-layer schema** (readOnly structural + editable enrichment):

- Sync layer (Function-written): `externalId`, `name`, `type`, `description`, `memberCount`
- Enrichment layer (CRM manager-authored): `affinityDescription`, `typicalCopyTone`, `engagementTier`

**Extension point**: For enterprise customers with a real CDP (Segment, AEP, ActionIQ), replace the `import-klaviyo` Function with a `import-cdp` Function. The segment schema remains unchanged; only the sync source changes.

**Workflow**: CRM manager runs "Import from Klaviyo" action → import-klaviyo Function syncs latest segments → CRM manager enriches new segments with copy-tone context (one-time per segment, persists across re-syncs).

### Preview Service Architecture

**Five versioned endpoints** (per brief §5 Implementation):

1. `GET /v1/render/local/:promotionId` — Content ops: renders MJML locally; resolves previewContext sample data; returns HTML + X-Preview-Status accuracy badge
2. `GET /v1/render/klaviyo/:promotionId` — CRM manager: calls Klaviyo `/api/template-render/` to verify Klaviyo's rendering of send-time stubs; returns Klaviyo's HTML + accuracy badge
3. `GET /v1/campaign-grid/:campaignId` — CampaignGrid view: returns JSON array of { promotionId, segment, localRender: html, status: metadata }
4. `POST /v1/preview/verify` — Integration engineer utility: test endpoint that renders a promotion, verifies sanitization, logs the output
5. `POST /webhooks/engagement-log-back` — Inbound: Klaviyo POSTs opens/clicks/conversions; writes to campaignPerformance fields

**Middleware stack** (via `@starter/preview-middleware`):

- `studioSessionMiddleware` on routes 1–4 (requires valid Studio session)
- `espWebhookMiddleware` on route 5 (verifies Klaviyo signature)
- `rateLimitMiddleware` on all (per-IP for unauthenticated, per-token for auth'd)
- `auditLoggingMiddleware` on all (structured logging, PII redaction)
- `securityHeaders` on all responses (CSP `script-src 'none'`, X-Frame-Options, X-Content-Type-Options, HSTS)

**Render pipeline** (streaming):

```
renderMjmlStream(mjml)
  → sanitizeStream (dompurify)
  → StubReplacerStream (Klaviyo stub handling: {{coupon_code}} → leave as-is with metadata)
  → streamToString or client (if HTTP Response, stream directly; if testing, consume to string)
```

**Accuracy badge** (X-Preview-Status header + metadata in response):

```json
{
  "resolved": {"subjectLine": "dynamic", "preheader": "dynamic", "first_name": "sample"},
  "stubbed": {"coupon_code": "send-time-only", "product_block": "send-time-only"},
  "accuracy": "high"
}
```

**Next.js adapter** (temporary, v1): Frontend service lives in `/frontend` and adapts `@starter/render-email` to Next.js Request/Response. Marked for migration to Sanity Functions in v2 (requires HTTP-invocable Functions to be GA).

### Sanity Functions

**`on-promotion-approved`**

- **Trigger**: promotion document approval (workflow.state transition)
- **Logic**: Compose ESP payload via `espConnector.compose(input)`, then `espConnector.dispatch(payload, adapter)` to POST to ESP (Klaviyo by default)
- **Return**: Write `sendId` back to promotion, update `sendState` field

**`import-klaviyo`** (adapted from `feat-email-marketing-klaviyo`)

- **Trigger**: Manual action "Import from Klaviyo" or scheduled (e.g., daily)
- **Logic**: Paginated list/segment sync from Klaviyo API; transaction-batched upserts/deletes; state machine (`importState: idle | syncing | completed`)
- **Return**: Create/update segment documents with synced layer fields

**`on-slot-needs-asset`**

- **Trigger**: emailSlot status → `needs-asset`
- **Logic**: Notify creative (via Slack webhook or internal task system) that a slot needs an image
- **Return**: Log notification, optionally create a creative task document

**`engagement-log-back`**

- **Trigger**: Inbound webhook from Klaviyo (POST /webhooks/engagement-log-back)
- **Logic**: Parse Klaviyo engagement payload (campaign ID, variant ID, event: open | click | conversion); fetch promotion; update `campaignPerformance` field with aggregated metrics
- **Return**: Write metrics, acknowledge webhook

### App SDK Dashboard (`apps/campaign-dashboard/`)

**Standalone app** (no Studio seat required)

- **Routes**:
  - `/campaigns` — list view: campaign title, start date, end date, urgency stage, cycle time (intake → approved), variant coverage (approved / total segments), status (in-progress | sent)
  - `/campaigns/:campaignId` — detail view: all variants with per-variant engagement deltas (open rate, CTR, conversion vs. base), performance trend sparklines
- **Data**: GROQ queries via App SDK React hooks (`useQuery`)
- **Auth**: App SDK auth (no Studio seat; browser session sufficient)
- **Performance**: Caches query results locally; refreshes on Campaign document publish

### Studio UI Surface Assignments

| Surface                    | Usage                                                                                                                                                                                                                               |
| :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document badges**        | `promotion`: workflow state tag + segment name. `segment`/`list`: "Managed in Klaviyo" origin label. `campaign`: urgency stage color-coded.                                                                                         |
| **Document actions**       | `campaign`: "Generate variants" (batch), "Import from Klaviyo" (audience sync). `promotion`: "Approve", "Resend" (workflow), "Multi-turn refinement" (AI). `segment`: "Mark enriched" (admin flag after CRM populates tone fields). |
| **Field actions**          | `subjectLine`, `preheader`, `disruptor`, `emailSlot.headline`, `emailSlot.subheadline`: `@sanity/assist` inline generation (one-off suggestions). Not the entry point for multi-turn — that's the VariantRefinementPanel.           |
| **Document inspector**     | `promotion`: preview accuracy badge (resolved/stubbed/unknown counts from X-Preview-Status), workflow history timeline. NOT the AI conversation panel.                                                                              |
| **Structure Builder view** | `campaign`: `<CampaignGrid>` custom view — all variant promotions side-by-side as Shadow DOM tiles (fast re-render on brief edit).                                                                                                  |
| **Presentation tool**      | `promotion`: configures to `/v1/render/local/:id` (Studio session auth) for 1:1 iframe preview.                                                                                                                                     |
| **App SDK app**            | Standalone campaign performance dashboard. Studio tool pane link as shortcut for ops lead.                                                                                                                                          |

### Context Management Pattern (Agentic-Localization Model)

Following the agentic-localization starter's two-level pattern:

**Supplemental context** (infrequently changing, brand-wide):

- `brandVoice` singleton document (tone traits, style rules, prohibited words, legal constraints)
- Shared reference data (urgencyStage, enticement, promoCode, termsAndConditions)

**Local context** (per-campaign, dynamic):

- `campaign` document fields (brief intent, toneTraits, emotionalGoal, primaryMessage, previewContext)
- Referenced `segment` enrichment fields (affinityDescription, typicalCopyTone, engagementTier)

**Injection**: `@sanity/agent-context` on `campaign` document serializes both tiers and injects them into all Content Agent API calls (batch generation, refinement, ad-hoc variants). No manual `promptAssembly.ts` — context is declarative.

**AI in-context**: Every `client.agent.action.generate()` call sees:

- Brief fields (primaryMessage, valueProposition, emotionalGoal, toneTraits)
- Segment profile (if generating for a specific segment)
- Available personalization tokens (from previewContext)
- Brand voice rules (from brandVoice singleton, via context)
- Prior accepted changes (current promotion state for refinement loops)

### Studio Auth Inheritance (content-agent v0.6.0)

**Pattern**: `createStudioAgent(client, workspace)` uses `credentials: 'include'` on all Content Agent API fetches; the browser's existing Studio session cookie authenticates all calls. No `SANITY_API_TOKEN` needed in plugin components.

**Usage in multi-turn refinement**:

```typescript
const client = useClient({apiVersion: '2024-01-01'})
const {name: workspace} = useWorkspace()
const contentAgent = useMemo(() => createStudioAgent(client, workspace), [client, workspace])
// contentAgent.agent(threadId) for multi-turn; thread ID keyed on promotion ID
```

**Caveat**: Browser-only. Server-side Functions (on-promotion-approved, engagement-log-back) still require an explicit `SANITY_API_READ_TOKEN`.

### Adaptation from `feat-email-marketing-klaviyo`

**Keep** (already high-quality):

- `functions/lib/klaviyo.ts` API client (v2025-07-15, correct error handling)
- `import-klaviyo` Function (paginated sync, state machine, transaction batching)
- Klaviyo Studio UX components (ImportFromKlaviyoAction, OpenKlaviyoAction)

**Rewrite**:

- Schema (introduce promotion, emailSlot; separate brief from targeting; add brandVoice + previewContext)
- Generation (document action on campaign → N promotions, not button on emailMessage)
- Render (real MJML via mjml package, not hand-rolled HTML strings)
- Preview service (streaming pipeline, Klaviyo verification endpoint, stubs, accuracy badge)
- App SDK dashboard (net-new)
- Security (7-layer posture: auth, input validation, sanitization, rate limiting, headers, audit logging)

## Testing Decisions

### Testing Philosophy

Test external behavior, not implementation details. A good test verifies the contract of a module (what it claims to do) without coupling to how it does it internally. For this starter:

- **Payload composers** are testable in isolation: given a promotion + campaign context, does `composeKlaviyoPayload()` return valid JSON:API format?
- **Render functions** are testable in isolation: given a promotion + previewContext, does `renderPromotionLocal()` return valid, sanitized HTML with stubs left in place?
- **Middleware** is testable as a chain: given a Request, do auth/rate-limit/headers middleware compose correctly?
- **Functions** are harder to test in isolation (they depend on Sanity client, external APIs), so focus on integration tests: does the full on-promotion-approved flow write the sendId back?

### Modules to Test

1. **`@starter/esp-connector`**
   - `composeKlaviyoPayload(input)` — does it produce valid Klaviyo JSON:API?
   - `KlaviyoConnector.dispatch(payload, adapter)` — does it call adapter.post() with the right URL/headers?
   - New connector implementations (Braze, AJO) — same contract tests apply

2. **`@starter/render-email`**
   - `renderPromotionLocal(promotion, previewContext)` — valid HTML? Stubs in place? Sample data resolved?
   - `renderMjmlStream(mjml)` → `sanitizeStream` → `StubReplacerStream` — does streaming pipeline preserve HTML structure and stubs?
   - `buildPreviewStatus(promotion)` — does accuracy metadata match resolved vs. stubbed fields?

3. **`@starter/preview-middleware`**
   - `studioSessionMiddleware(req, next)` — does it block unauthenticated requests? Calls next() for valid sessions?
   - `rateLimitMiddleware(req, next)` — does it enforce per-IP limits? Allow burst traffic?
   - `securityHeaders` — does SECURITY_HEADERS constant contain CSP, HSTS, X-Frame-Options?

4. **Sanity Functions** (integration tests, real client)
   - `on-promotion-approved` — given an approved promotion, does the Function call espConnector and write sendId back?
   - `import-klaviyo` — does the Function paginate, upsert segments, handle errors gracefully?

### Prior Art

The agentic-localization starter has integration tests for Functions (e.g., `@sanity/cli` test hook). Reference those patterns. No mocking of the Sanity client; use a test dataset with real schema and seed documents.

### Test Framework

Recommend **Vitest** (already used in many Sanity starters) for unit tests of packages. **MSW** for mocking external APIs (Klaviyo, Stripe, etc.) in preview service tests. **@sanity/cli test** or **@sanity/test-utils** for Function integration tests.

## Out of Scope

1. **HTTP-invocable Sanity Functions** — The preview service uses Next.js in v1. Migration to Sanity Functions requires HTTP-invocation to ship as GA (currently roadmap). Marked as v2 work.

2. **Non-Klaviyo ESPs** (beyond the connector abstraction) — Braze, AJO, Marketo connectors are out of scope for this starter. The abstraction is there; implementations are customer-driven or future PRs.

3. **Transactional email** — This starter is promotional campaigns only. Transactional (order confirmations, password resets, shipping updates) are fundamentally different ownership models and belong in a separate starter.

4. **Agency / white-label portal** — Some customers may want to build an external reviewing portal for reviewers without Sanity access. Out of scope; the shareable preview link + inline comments are the baseline.

5. **Advanced localization** — Multi-language campaigns are out of scope. The schema is prepared (references are portable), but UX for localized variant generation is not included.

6. **Advanced analytics** — The dashboard shows basic cycle time and engagement deltas. Advanced attribution, revenue impact, A/B testing statistical significance are out of scope.

## Further Notes

### Ahead-of-Product Dependencies

Three surfaces are shipped as GA (`@sanity/agent-context`, Content Agent API, Sanity Functions); four are ahead of product or require custom integration:

1. **Portable Text → email-safe HTML renderer** — No shipped `@portabletext/to-mjml` package. The starter ships `@starter/render-email` with MJML rendering (uses the `mjml` npm package directly). For Portable Text fields (e.g., disclaimers, CTAs), the starter ships a helper; production use should consider upgrading to a shipped renderer when available.

2. **Klaviyo `/api/template-render/` pattern** — Klaviyo's API is real; the preview service pattern (streaming, stub handling, accuracy badges) is custom. Other ESPs (Braze, AJO) have different render APIs; each preview route is ESP-specific.

3. **HTTP-invocable Sanity Functions** — The preview service uses Next.js today. If Sanity Functions ship HTTP invocation as GA, the preview service can migrate to a platform-agnostic `@starter/preview-service-functions` package. Marked as v2 work.

### Performance & Scaling

- **Preview service**: Streaming MJML render + sanitization is CPU-bound (especially with large images or slot counts). Rate limiting and caching are essential.
- **Batch generation**: Spawning N segment-variant promotions via Content Agent API is N parallel `generate()` calls. No built-in batching in Content Agent API v0.6.0; clients batch explicitly (Document action loops over segments and calls generate per segment).
- **Engagement log-back**: Klub iyo webhooks can be high-volume (millions of opens per day for large senders). The engagement-log-back Function should aggregate metrics in-memory before writing back to Sanity (batched updates, not one write per event).

### Security Posture

The starter enforces a 7-layer security model:

1. **Transport**: HTTPS (delegated to hosting, e.g., Vercel)
2. **Auth**: Studio session (preview routes), preview URL secret (external reviewers), Klaviyo webhook signature (inbound)
3. **Input validation**: Zod schemas on all Function inputs; runtime validation of Sanity responses
4. **Render-time**: SSRF protection (no arbitrary URL fetches in render logic), HTML sanitization (dompurify), no eval()
5. **Output headers**: CSP `script-src 'none'`, X-Frame-Options `SAMEORIGIN`, X-Content-Type-Options `nosniff`, HSTS
6. **Rate/abuse**: Per-IP and per-token rate limiting on preview routes
7. **Logging/audit**: Structured logging with PII redaction (email addresses, segment names) on sensitive operations

### Deployment Notes

**Sanity Studio**: Deploy as a standard `@sanity/cli` Studio (via `sanity deploy` or your CI/CD).

**Functions**: Deploy via `sanity deploy` (event-triggered Functions) or `sanity functions deploy` if using HTTP invocation (v2).

**Preview service** (v1, Next.js): Deploy to Vercel or your host. Requires `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_READ_TOKEN`, `KLAVIYO_API_KEY` env vars. In v2, migrate to Sanity Functions and remove Next.js dependency.

**App SDK dashboard**: Deploy to Vercel or your host. Can be embedded in Studio via App SDK plugin (optional).

---

## Appendix: Document Model Diagram

```
campaign
├── primaryMessage
├── emotionalGoal
├── toneTraits
├── segments (references → segment[])
├── previewContext (key-value map)
└── @sanity/agent-context wiring
    ├── Serializes campaign fields (local context)
    └── Serializes brandVoice singleton (supplemental)

↓ (Content Agent API generates)

promotion (base) + promotion[] (segment-variants)
├── campaign (reference)
├── segment (reference, nullable for base)
├── subjectLine (@sanity/assist)
├── preheader (@sanity/assist)
├── disruptor (@sanity/assist)
├── emailSlots[]
│   ├── position (enum)
│   ├── asset (reference)
│   ├── headline (@sanity/assist)
│   └── subheadline (@sanity/assist)
├── campaignPerformance (readOnly, written by engagement-log-back)
└── workflow.state (parallel document, not embedded)

segment (two-layer)
├── [ReadOnly synced by import-klaviyo]
│   ├── externalId
│   ├── name
│   └── description
└── [Editable enrichment by CRM manager]
    ├── affinityDescription
    ├── typicalCopyTone
    └── engagementTier
```
