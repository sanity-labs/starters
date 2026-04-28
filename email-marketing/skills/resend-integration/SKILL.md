---
name: resend-integration
description: 'Integrate with Resend - API key setup, sync segments, compose and send broadcasts via Sanity Functions, handle Svix webhooks. Entry points - Resend SDK calls in functions/on-promotion-approved (broadcasts.create + send), functions/import-resend-segments (segment sync), frontend webhook handler (Svix verification). Trigger on - Resend API, email send, segment sync, engagement tracking, ESP configuration, broadcast.'
---

# Resend Integration for Email Marketing

Send broadcasts through Resend from Sanity. Sync static segments from Resend; compose and dispatch promotions via the Resend Broadcasts API; verify and ingest delivery / open / click webhooks via Svix. The Resend Node SDK is called directly from each Sanity Function — there is no shared connector package.

> **Before writing code:** Resend's API surface evolves. Fetch [`https://resend.com/llms.txt`](https://resend.com/llms.txt) (Resend's canonical AI entry point) and confirm method signatures against the latest [Resend docs](https://resend.com/docs) before relying on memorized SDK shapes.

## Setup

### 1. Obtain a Resend API key

In the Resend dashboard:

1. Go to **API Keys** in the left nav
2. Click **Create API Key**
3. Name it (e.g., "Sanity Starter")
4. Choose a scope that allows sending and managing segments

Copy the key (format: `re_…`).

### 2. Verify a sending domain

Resend will not deliver email until your sending domain is verified.

1. Go to **Domains** → **Add Domain**, enter your domain (or a subdomain like `updates.example.com`)
2. Add the SPF and DKIM TXT records Resend gives you to your DNS provider
3. Wait for verification (usually a few minutes)
4. Use a `from` address on that domain — e.g. `"Brand <updates@example.com>"`

For local testing without a verified domain, use the onboarding sandbox `from: "onboarding@resend.dev"` (only delivers to your own account email).

### 3. Set environment variables

**On Sanity Function runtimes:**

```bash
npx sanity functions env add on-promotion-approved RESEND_API_KEY re_your_key_here
npx sanity functions env add on-promotion-approved RESEND_FROM_EMAIL "Brand <updates@example.com>"
npx sanity functions env add import-resend-segments RESEND_API_KEY re_your_key_here
```

The `pnpm bootstrap` script prompts for these and sets them automatically.

**In `frontend/.env`** (preview route + webhook):

```
RESEND_API_KEY=re_your_key_here
RESEND_WEBHOOK_SECRET=whsec_your_signing_secret
RESEND_FROM_EMAIL=Brand <updates@example.com>
```

### 4. Register the engagement webhook

1. In Resend, go to **Webhooks** → **Add Webhook**
2. Endpoint URL: `https://<your-frontend-domain>/api/webhooks/engagement`
3. Subscribe to: `email.opened`, `email.clicked`, `email.bounced`, `email.delivered`, `email.complained`
4. Copy the signing secret (starts with `whsec_`) and set `RESEND_WEBHOOK_SECRET` in `frontend/.env`

## Architecture

### No shared connector package

Earlier drafts of this starter shipped a `@starter/esp-connector` package. That abstraction was removed. **Each function calls the Resend Node SDK directly.** This keeps the code path obvious: if you want to know how the starter sends, read `functions/on-promotion-approved/index.ts`.

### Where Resend is called

| Surface        | File                                                  | Purpose                                                        |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| Send           | `functions/on-promotion-approved/index.ts`            | `resend.broadcasts.create()` then `resend.broadcasts.send()`   |
| Segment sync   | `functions/import-resend-segments/index.ts`           | `resend.segments.list()` + `resend.contacts.list({segmentId})` |
| Scheduled sync | `functions/scheduled-import-resend-segments/index.ts` | Flips `espImport.importState` to `"requested"` every 5 min     |
| Webhook verify | `frontend/app/api/webhooks/engagement/route.ts`       | `resend.webhooks.verify({payload, headers, webhookSecret})`    |
| Open in Resend | `studio/components/OpenResendAction.tsx`              | Deep-link to `https://resend.com/broadcasts/{id}`              |

### Send flow

```
buildHtml(promotion)
  → resend.broadcasts.create({segmentId, from, subject, html})
  → resend.broadcasts.send(broadcast.id)
  → patch promotion.externalCampaignId = broadcast.id
```

Two API calls. There is no template lifecycle to manage — Resend doesn't store reusable templates, you just pass HTML on each send.

### Segment sync

Resend Segments are static contact lists. The starter's segment sync calls `resend.segments.list()`, then for each segment calls `resend.contacts.list({segmentId})` to count contacts. Synced fields (`externalId`, `name`, `memberCount`) land on the readOnly layer of the `segment` document. Editable enrichment (`affinityDescription`, `typicalCopyTone`, `engagementTier`) is preserved across re-syncs via partial patch.

### Webhook flow (Svix)

Resend signs webhook payloads via Svix:

```ts
import {Resend} from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(request: Request) {
  const rawBody = await request.text() // raw body required

  try {
    resend.webhooks.verify({
      payload: rawBody,
      headers: {
        'svix-id': request.headers.get('svix-id') ?? '',
        'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
        'svix-signature': request.headers.get('svix-signature') ?? '',
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    })
  } catch {
    return new Response('Unauthorized', {status: 401})
  }

  const event = JSON.parse(rawBody)
  // map event.data.broadcast_id → promotion.externalCampaignId, increment counters
}
```

**Headers:** `svix-id`, `svix-timestamp`, `svix-signature`. **Verify on the raw body** — never on parsed JSON.

**Event mapping:**

| Resend event       | `campaignPerformance` field     |
| ------------------ | ------------------------------- |
| `email.opened`     | `openRate++`                    |
| `email.clicked`    | `clickThroughRate++`            |
| `email.bounced`    | (log only)                      |
| `email.delivered`  | (ignore)                        |
| `email.complained` | (treat as unsubscribe-adjacent) |

`conversionRate` has no source from Resend — see [`docs/ESP-NOTES.md`](../../docs/ESP-NOTES.md).

## Functions

### 1. `import-resend-segments` — sync segments

**File:** `functions/import-resend-segments/index.ts`

Triggered by an `espImport` document with `importState: 'requested'`.

**Workflow:**

1. Patch `espImport.importState = 'importing'`
2. Call `resend.segments.list()`
3. For each segment, call `resend.contacts.list({segmentId})` to count contacts
4. Upsert `segment` documents (synced fields only — preserves enrichment layer)
5. Delete stale `segment` documents
6. Patch `espImport` with `importState: 'imported'`, `lastImportedAt`, `segmentCount`

**Schema pattern** (`studio/schemaTypes/reference-data/segment.ts`):

```ts
{
  name: 'segment',
  type: 'document',
  fields: [
    // Synced (readOnly) — overwritten on each sync
    {name: 'externalId', type: 'string', readOnly: true},
    {name: 'name', type: 'string', readOnly: true},
    {name: 'memberCount', type: 'number', readOnly: true},
    {name: 'isActive', type: 'boolean', readOnly: true},

    // Enrichment (editable) — preserved across syncs
    {name: 'affinityDescription', type: 'text'},
    {name: 'typicalCopyTone', type: 'array', of: [{type: 'string'}]},
    {name: 'engagementTier', type: 'string', options: {list: ['low', 'mid', 'high', 'vip']}},
  ],
}
```

### 2. `scheduled-import-resend-segments` — cron sync

**File:** `functions/scheduled-import-resend-segments/index.ts`

Fires on cron (`every 5 minutes`). Patches the `espImport` singleton's `importState` to `"requested"`, which in turn triggers `import-resend-segments`. Authenticates via the robot token defined in `sanity.blueprint.ts`. No-op if a sync is already in progress.

### 3. `on-promotion-approved` — send via Resend

**File:** `functions/on-promotion-approved/index.ts`

Triggered when `workflow.state` for a promotion transitions to `"approved"`.

**Workflow:**

1. Fetch promotion + campaign + segment context
2. Build HTML via `buildHtml(promotion)` (ESP-agnostic; emits `{{{RESEND_UNSUBSCRIBE_URL}}}` for the unsubscribe merge tag)
3. `resend.broadcasts.create({segmentId, from: process.env.RESEND_FROM_EMAIL, subject, html})`
4. `resend.broadcasts.send(broadcast.id)`
5. Patch promotion: `externalCampaignId = broadcast.id`, `workflow.state = 'sent'`, append history entry
6. On failure: patch `workflow.state = 'failed'` with error message

**Don't:**

- Don't try to create a "template" first — Resend has no stored-template concept.
- Don't pass a top-level `preheader` — Resend has no field for it. Put preheader content in the HTML itself.

### 4. `on-promotion-test-send` — send a test email

**File:** `functions/on-promotion-test-send/index.ts`

Triggered when `promotion.testSend.status` is set to `"requested"` (by the "Send test email" Studio document action on a promotion).

**Workflow:**

1. Fetch promotion (no segment, no campaign — just the promotion content)
2. Build HTML via the same renderer as `on-promotion-approved`
3. `resend.emails.send({from: process.env.RESEND_FROM_EMAIL, to: process.env.RESEND_TEST_TO ?? 'delivered@resend.dev', subject: '[TEST] ' + subjectLine, html})` — **transactional** send, single recipient, no Segment, no Broadcast
4. Patch `promotion.testSend`: `status = 'sent'`, `sentAt`, `sentTo`. On failure: `status = 'error'`, `errorMessage`.

**Why this exists:**

- Verifies the rendering + Resend SDK path end-to-end without firing a real Broadcast.
- Default recipient `delivered@resend.dev` is a Resend simulation address — it logs in the dashboard but doesn't deliver. Useful in CI / staging.
- Other simulation addresses: `bounced@resend.dev`, `complained@resend.dev`, `suppressed@resend.dev`, with `+label` support (e.g. `delivered+signup@resend.dev`).
- For a real inbox test, set `RESEND_TEST_TO=you@yourdomain.com` after verifying your domain.

**Caveat:** Sending from `onboarding@resend.dev` (the sandbox `from`) only allows delivery to the Resend account owner's email. To target the simulation addresses, set `RESEND_FROM_EMAIL` to a verified-domain address.

## Preview

Resend has **no server-side render API**. Preview is generated locally via `@react-email/render` in `frontend/app/api/preview/resend/[id]/route.ts`:

```ts
import {render} from '@react-email/render'

const html = await render(<PromotionEmail promotion={promotion}/>)
return new Response(html, {
  status: 200,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'X-Preview-Status': 'local-render',
  },
})
```

The `X-Preview-Status: local-render` header makes the rendering source explicit.

## Functional gaps

Resend is not a 1:1 replacement for a behavioral marketing platform. Surface these to users before they design around features that don't exist:

- No behavioral / dynamic segments (segments are static lists)
- No flows / journeys / triggered automations
- No metric-event ingestion (no source for `conversionRate`)
- No server-side template render API
- No built-in A/B testing

Full list and guidance for working around them: [`docs/ESP-NOTES.md`](../../docs/ESP-NOTES.md).

## Jobs to be done

### 1. Set up Resend in a new Sanity project

- Create a Resend API key
- Verify a sending domain (SPF + DKIM)
- Run `pnpm bootstrap` (or set the env vars manually on the function runtime + frontend `.env`)
- Open the **Sync / Import** singleton in Studio and click **Import from Resend** — segments appear as Sanity documents

### 2. Send a promotion

- Create a `campaign` brief
- Run **Generate variants** → creates promotions
- Review and approve a promotion
- Approval triggers `on-promotion-approved`, which creates and sends a Resend broadcast
- The promotion's `externalCampaignId` field gets the returned `broadcast.id`; the **Open in Resend** action deep-links to `https://resend.com/broadcasts/{id}`

### 3. Verify before sending

- Open the **Preview** tab on a promotion (renders locally via `@react-email/render`)
- Or hit `https://<frontend>/api/preview/resend/<promotionId>` directly
- The `X-Preview-Status: local-render` header confirms preview was generated locally

### 4. Track engagement post-send

- Configure the engagement webhook in Resend (see Setup)
- Webhook fires for opens, clicks, bounces, deliveries, complaints
- `frontend/app/api/webhooks/engagement/route.ts` verifies the Svix signature and patches `promotion.campaignPerformance`
- Studio dashboard queries the field to show per-variant engagement deltas

### 5. Re-sync segments after changes in Resend

- New segment created in Resend
- Either click **Import from Resend** in Studio, or wait up to 5 minutes for `scheduled-import-resend-segments` to fire
- New `segment` documents appear; enrichment fields on existing segments are preserved

## Testing

### Unit

- `buildHtml(promotion)` — produces valid HTML with `{{{RESEND_UNSUBSCRIBE_URL}}}` merge tag
- Webhook event mapping — `email.opened` increments `openRate`, etc.

### Integration

- Mock the Resend SDK
- `on-promotion-approved` with valid promotion → calls `broadcasts.create` then `broadcasts.send`, persists `externalCampaignId`
- `import-resend-segments` with mock segment list → upserts segment documents, preserves enrichment fields
- Engagement webhook with valid Svix signature → patches `campaignPerformance`; bad signature → 401

### Manual

- Create a Segment in Resend with one contact (your own email)
- Bootstrap the project and sync segments
- Build a campaign + promotion targeting that segment, hit Approve
- Confirm: email arrives. Open it. Click a link.
- Confirm in Studio: `promotion.campaignPerformance.openRate` and `clickThroughRate` increment.

## References

- `functions/on-promotion-approved/index.ts` — broadcast send
- `functions/import-resend-segments/index.ts` — segment sync
- `functions/scheduled-import-resend-segments/index.ts` — cron trigger
- `frontend/app/api/webhooks/engagement/route.ts` — Svix-verified webhook
- `frontend/app/api/preview/resend/[id]/route.ts` — local preview render
- `studio/components/OpenResendAction.tsx`, `studio/components/ImportFromResendAction.tsx` — Studio actions
- `docs/ESP-NOTES.md` — Resend functional gaps and how to work around them
- [Resend `llms.txt`](https://resend.com/llms.txt) — canonical AI entry point
- [Resend docs](https://resend.com/docs)
