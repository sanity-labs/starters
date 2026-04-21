---
name: klaviyo-integration
description: 'Integrate with Klaviyo: API key setup, sync lists and segments, compose and send campaigns, verify templates, handle webhooks. Entry points: KlaviyoConnector, import-klaviyo Function, on-promotion-approved Function, engagement-log-back webhook handler. Trigger on: Klaviyo API, email send, segment sync, engagement tracking, ESP configuration.'
---

# Klaviyo Integration for Email Marketing

Send campaigns through Klaviyo from Sanity. Sync audience lists and segments from Klaviyo; compose and dispatch promotions with template creation and campaign sending; handle inbound engagement webhooks. All wired through the `@starter/esp-connector/klaviyo` reference implementation.

## Setup

### 1. Obtain Klaviyo API Key

In Klaviyo:

1. Go to **Settings** → **API Keys**
2. Click **Create Private API Key**
3. Name it (e.g., "Sanity Starter")
4. Select **Custom** scope and enable:
   - Lists: Read
   - Segments: Read
   - Templates: Read/Write
   - Campaigns: Read/Write

Copy the private key (format: `pk_...`).

### 2. Set Environment Variables

```bash
npx sanity functions env add on-promotion-approved KLAVIYO_API_KEY pk_your_key_here
npx sanity functions env add import-klaviyo KLAVIYO_API_KEY pk_your_key_here
npx sanity functions env add engagement-log-back KLAVIYO_API_KEY pk_your_key_here
```

Or via `sanity.json` blueprint config for automatic setup.

## Architecture

### Package: `@starter/esp-connector/klaviyo`

Entry point: `packages/esp-connector/src/klaviyo/`

**Structure:**

```
packages/esp-connector/src/klaviyo/
├── client.ts           — Klaviyo API client
├── connector.ts        — KlaviyoConnector class
├── payload.ts          — KlaviyoPayload composition
└── index.ts            — exports for ./klaviyo subpath
```

### Klaviyo API Client

**File:** `packages/esp-connector/src/klaviyo/client.ts`

Wraps the Klaviyo v2025-07-15 API with authentication headers and error handling.

**Core functions:**

```typescript
export async function klaviyoFetch(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options?: {apiKey?: string; timeout?: number},
): Promise<KlaviyoResponse<T>>

// Templates
export async function createKlaviyoTemplate(
  templateName: string,
  htmlBody: string,
  options: {apiKey: string; subject: string; preheader: string},
): Promise<{id: string}>

export async function getKlaviyoTemplate(
  templateId: string,
  options: {apiKey: string},
): Promise<{id: string; name: string; html: string}>

// Campaigns
export async function createKlaviyoCampaign(
  campaignName: string,
  templateId: string,
  listId: string,
  segmentIds?: string[],
  options?: {apiKey: string},
): Promise<{id: string; status: 'draft' | 'scheduled' | 'sent'}>

export async function sendKlaviyoCampaign(
  campaignId: string,
  options: {apiKey: string; scheduled?: boolean; sendTime?: string},
): Promise<{status: 'sending' | 'sent'}>

// Audiences
export async function getKlaviyoLists(options: {
  apiKey: string
}): Promise<Array<{id: string; name: string; memberCount: number}>>

export async function getKlaviyoSegments(options: {
  apiKey: string
}): Promise<Array<{id: string; name: string; definition?: string; memberCount: number}>>

// Template verification
export async function renderKlaviyoTemplate(
  templateId: string,
  personalizationData?: Record<string, unknown>,
  options?: {apiKey: string},
): Promise<{html: string; errors: Array<{field: string; reason: string}>}>
```

### KlaviyoConnector

**File:** `packages/esp-connector/src/klaviyo/connector.ts`

Implements the `EspConnector<KlaviyoPayload>` interface.

```typescript
export class KlaviyoConnector implements EspConnector<KlaviyoPayload> {
  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async compose(input: ComposerInput): Promise<KlaviyoPayload> {
    // Assembles Klaviyo JSON:API payload
    return {
      data: {
        type: 'email-template',
        attributes: {
          name: input.campaignName,
          subject_line: input.subjectLine,
          preheader_text: input.preheader,
          html_body: this.injectPersonalizationTokens(input.htmlBody, input.personalizationTokens),
          editor: 'custom',
        },
      },
    }
  }

  async dispatch(payload: KlaviyoPayload, adapter: DispatchAdapter): Promise<DispatchResult> {
    // 1. Create template
    const templateRes = await createKlaviyoTemplate(
      payload.data.attributes.name,
      payload.data.attributes.html_body,
      {
        apiKey: this.apiKey,
        subject: payload.data.attributes.subject_line,
        preheader: payload.data.attributes.preheader_text,
      },
    )

    // 2. Create campaign
    const campaignRes = await createKlaviyoCampaign(
      payload.data.attributes.name,
      templateRes.id,
      payload.listId,
      payload.segmentIds,
      {apiKey: this.apiKey},
    )

    // 3. Send campaign
    const sendRes = await sendKlaviyoCampaign(campaignRes.id, {
      apiKey: this.apiKey,
      scheduled: payload.scheduledFor ? true : false,
      sendTime: payload.scheduledFor,
    })

    return {
      success: sendRes.status === 'sent' || sendRes.status === 'sending',
      campaignId: campaignRes.id,
      templateId: templateRes.id,
      sendId: campaignRes.id,
    }
  }

  verify?(payload: KlaviyoPayload): Promise<VerificationResult> {
    // Test-render without sending
    return renderKlaviyoTemplate(payload.templateId, payload.personalizationData, {
      apiKey: this.apiKey,
    })
  }

  private injectPersonalizationTokens(html: string, tokens: Record<string, unknown>): string {
    // Convert Sanity preview context tokens to Klaviyo syntax
    // { first_name: "John" } → {{ profile.first_name }}
    let result = html
    for (const [key, value] of Object.entries(tokens)) {
      result = result.replace(`{{${key}}}`, `{{ profile.${key} }}`)
    }
    return result
  }
}
```

## Functions

### 1. `import-klaviyo` — Sync lists and segments

**File:** `functions/import-klaviyo/index.ts`

Triggered by a request document (`klaviyoImport` type with `importState: 'requested'`).

**Workflow:**

1. Fetch all Klaviyo lists via `getKlaviyoLists()`
2. Fetch all Klaviyo segments via `getKlaviyoSegments()`
3. For each list, create or update a Sanity `list` document
4. For each segment, create or update a Sanity `segment` document
5. Mark `importState` as `'complete'`

**Key:**

- `segment` documents are **two-layer**: readOnly synced fields (`externalId`, `name`, `memberCount`) + editable enrichment fields (`affinityDescription`, `typicalCopyTone`, `engagementTier`)
- The sync only overwrites the readOnly layer; enrichment persists across re-syncs
- Use `externalId` as the foreign key to Klaviyo's segment ID

**Schema pattern:**

```typescript
// studio/schemaTypes/segment.ts
{
  name: 'segment',
  type: 'document',
  fields: [
    // Synced (readOnly)
    { name: 'externalId', type: 'string', readOnly: true },
    { name: 'name', type: 'string', readOnly: true },
    { name: 'description', type: 'text', readOnly: true },
    { name: 'memberCount', type: 'number', readOnly: true },

    // Enrichment (editable)
    { name: 'affinityDescription', type: 'text' }, // CRM-authored audience brief
    { name: 'typicalCopyTone', type: 'array', of: [{ type: 'string' }] }, // tags
    { name: 'engagementTier', type: 'string', options: { list: ['low', 'mid', 'high', 'vip'] } },
  ],
}
```

### 2. `on-promotion-approved` — Send via Klaviyo

**File:** `functions/on-promotion-approved/index.ts`

Triggered by `workflow.state` approval (promotion `status: 'approved'`).

**Workflow:**

1. Fetch promotion + campaign context
2. Build `KlaviyoPayload` via `new KlaviyoConnector(apiKey).compose()`
3. Dispatch via `createPayloadDispatcher(...).dispatch()`
4. Patch promotion document: write `sendId`, `sentAt`, `sendState: 'sent'`
5. If dispatch fails, patch with `sendState: 'error'` + error message

**Key patterns:**

- Use the retry dispatcher to handle transient Klaviyo API failures
- Log successes and failures with campaign + segment context
- Never modify a published promotion after send (idempotence)

### 3. `engagement-log-back` — Inbound Klaviyo webhooks

**File:** `functions/engagement-log-back/index.ts`

Webhook handler for Klaviyo engagement events (opens, clicks, bounces, unsubscribes).

**Webhook setup in Klaviyo:**

1. Go to **Settings** → **Integrations** → **Webhooks**
2. Create webhook:
   - URL: `https://[your-domain]/functions/engagement-log-back`
   - Events: `email.open`, `email.click`, `email.bounce`, `email.unsubscribe`
   - Custom header: `X-Webhook-Signature` (Klaviyo provides the signing key)

**Workflow:**

1. Verify webhook signature via HMAC-SHA256 (prevent replay attacks)
2. Parse event: `{ event_type: 'email.open', data: { campaign_id: '...', profile: { email: '...' }, timestamp: '...' } }`
3. Map `campaign_id` (Klaviyo UUID) to Sanity promotion ID
4. Increment counters on `promotion.campaignPerformance`:
   - `opens += 1`
   - `clicks += 1` (if `email.click`)
   - `bounces += 1` (if `email.bounce`)
5. Update `lastEngagementAt` timestamp

**Schema pattern:**

```typescript
// studio/schemaTypes/campaignPerformance.ts
{
  name: 'campaignPerformance',
  type: 'object',
  readOnly: true,
  fields: [
    { name: 'sentAt', type: 'datetime', readOnly: true },
    { name: 'opens', type: 'number', readOnly: true },
    { name: 'clicks', type: 'number', readOnly: true },
    { name: 'bounces', type: 'number', readOnly: true },
    { name: 'unsubscribes', type: 'number', readOnly: true },
    { name: 'lastEngagementAt', type: 'datetime', readOnly: true },
  ],
}
```

## Preview Service: Klaviyo Verification

The preview service exposes a `/v1/render/klaviyo/:id` endpoint that:

1. Fetches promotion + campaign context
2. Builds MJML from emailSlots
3. Resolves preview context tokens (sample data from `campaign.previewContext`)
4. Calls `connector.verify?()` to test-render via Klaviyo's `/api/template-render/` endpoint
5. Returns the Klaviyo-rendered HTML with `X-Preview-Status` accuracy badge

This endpoint shows CRM managers exactly how the email will render in Klaviyo when sent.

## Jobs to Be Done

### 1. Set up Klaviyo in a new Sanity project

- Create Klaviyo private API key
- Set environment variables on Functions
- Run `import-klaviyo` to sync lists and segments
- Verify `list` and `segment` documents appear in Studio

### 2. Generate and send a promotion to Klaviyo

- Create `campaign` brief
- Run "Generate variants" action → creates promotions
- Review and approve a promotion
- Approval triggers `on-promotion-approved` Function
- Function composes `KlaviyoPayload`, calls Klaviyo APIs, writes `sendId` back
- Verify campaign appears in Klaviyo account

### 3. Verify preview before sending

- In Presentation tool, load `/v1/render/klaviyo/:promotionId`
- See how Klaviyo's template renderer will output it
- Check `X-Preview-Status` header for token resolution counts

### 4. Track engagement post-send

- Configure Klaviyo webhook → `engagement-log-back` Function
- Webhook fires for opens, clicks, bounces, unsubscribes
- Function patches promotion's `campaignPerformance` fields
- Dashboard queries aggregates metrics across variants

### 5. Re-sync Klaviyo audiences after changes

- New list added in Klaviyo
- Create `klaviyoImport` document with `importState: 'requested'`
- `import-klaviyo` Function fires
- New `list` and `segment` documents appear; enrichment fields remain

### 6. Add a new segment variant after initial generation

- New CDP segment created
- Run "Generate for segment" action on campaign
- Selects the single segment
- `GenerateVariantsAction` creates one new promotion for that segment
- Approve and send as normal

## Testing

### Unit tests

- `KlaviyoConnector.compose()` — given input, produces valid JSON:API payload
- Token injection — `{{ first_name }}` → `{{ profile.first_name }}`

### Integration tests

- Mock Klaviyo API responses
- `on-promotion-approved` with valid promotion → creates template, campaign, sends
- `import-klaviyo` with mock list/segment responses → creates Sanity documents
- `engagement-log-back` with valid webhook signature → patches campaignPerformance

### Manual testing

- Create campaign, generate variant, approve, verify send in Klaviyo account
- Trigger open/click webhook, verify promotion metrics update in Studio

## References

- `packages/esp-connector/src/klaviyo/` — Klaviyo API client and connector
- `functions/on-promotion-approved/` — send Function
- `functions/import-klaviyo/` — segment sync Function
- `functions/engagement-log-back/` — webhook handler
- [Klaviyo API v2025-07-15 docs](https://developers.klaviyo.com/en/reference/api_overview)
