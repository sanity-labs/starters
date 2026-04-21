---
name: esp-connector-pattern
description: Build ESP-agnostic email dispatch layers. Core interface, Klaviyo reference implementation, Braze and AJO extension patterns. Trigger on: ESP integration, connector development, payload composition, add new email service provider, multi-ESP support.
---

# ESP-Agnostic Connector Pattern

Build pluggable integrations for any Email Service Provider (ESP). The pattern separates the interface contract from the implementation: a Sanity Function calls a generic `EspConnector<TPayload>` interface; one module per ESP implements that interface with vendor-specific payload composition and dispatch logic. Adding Braze or AJO means writing new code, never modifying existing Klaviyo code.

## Core Principle

**Open-Closed Principle:** New ESPs add new code (new `./braze`, `./ajo` exports) without ever modifying the existing Klaviyo implementation. The interface is stable; implementations extend it.

## Architecture

### Package: `@starter/esp-connector`

Lives at `packages/esp-connector/` with `"name": "@starter/esp-connector"` in package.json.

**Exports:**

- `.` — `EspConnector<TPayload>` interface, `createPayloadDispatcher()` factory with retry logic
- `./klaviyo` — `KlaviyoConnector` class, `KlaviyoPayload` type
- `./types` — shared types
- `./braze` — (future) `BrazeConnector` class, `BrazePayload` type
- `./ajo` — (future) `AdobeAjoConnector` class, `AjoPayload` type

**Internal cross-package references use `#imports`:**

```json
{
  "imports": {
    "#types": "./src/types.ts",
    "#utils": "./src/utils.ts"
  }
}
```

No deep relative paths within the package (`../../types`); all references go through `#imports`.

### Core Interface

```typescript
export interface EspConnector<TPayload> {
  compose(input: ComposerInput): Promise<TPayload>
  dispatch(payload: TPayload, adapter: DispatchAdapter): Promise<DispatchResult>
  verify?(payload: TPayload): Promise<VerificationResult>
}

export interface ComposerInput {
  promotionId: string
  campaignId: string
  segmentId: string
  subjectLine: string
  preheader: string
  disruptor: string
  htmlBody: string
  campaignName: string
  segments: string[]
  personalizationTokens: Record<string, unknown>
  brandVoice: BrandVoiceContext
}

export interface DispatchAdapter {
  fetch: typeof fetch
  timeout: number
  maxRetries: number
}

export interface DispatchResult {
  success: boolean
  campaignId: string
  templateId: string
  sendId?: string
  error?: string
}
```

Implementations are **not** required to match Klaviyo's JSON:API format — each ESP is free to compose its own payload shape. The `TPayload` generic is the escape hatch.

## Klaviyo Reference Implementation

Entry point: `packages/esp-connector/src/klaviyo/connector.ts`

### Structure

```
packages/esp-connector/src/klaviyo/
├── client.ts           — Klaviyo API client (klaviyoFetch, v2025-07-15)
├── connector.ts        — KlaviyoConnector class (implements EspConnector)
├── payload.ts          — KlaviyoPayload type + compose logic
├── index.ts            — exports for ./klaviyo subpath
```

### Key Components

**`client.ts` — Klaviyo API client**

- `klaviyoFetch(method, path, body?, options?)` — wraps fetch with auth headers, Revision header
- `createKlaviyoTemplate()` — POST /api/templates (create email template)
- `createKlaviyoCampaign()` — POST /api/campaigns (create campaign from template)
- `sendKlaviyoCampaign()` — POST /api/campaigns/:id/send (trigger send)
- `getKlaviyoLists()` — GET /api/lists (fetch audience lists)
- `getKlaviyoSegments()` — GET /api/segments (fetch audience segments)

**`connector.ts` — KlaviyoConnector**

Implements `EspConnector<KlaviyoPayload>`:

- `compose(input)` — assembles KlaviyoPayload JSON from promotion + campaign context
- `dispatch(payload, adapter)` — POST to Klaviyo API with retry logic, timeout, error handling
- `verify?(payload)` — (optional) test-render the payload without sending

**`payload.ts` — Payload composition**

Builds the Klaviyo JSON:API request:

```typescript
interface KlaviyoPayload {
  data: {
    type: 'email-template'
    attributes: {
      name: string
      subject_line: string
      preheader_text: string
      html_body: string
    }
  }
}
```

## How to Add a New ESP (Braze Example)

### Step 1: Create the Braze module structure

```
packages/esp-connector/src/braze/
├── client.ts           — Braze API client
├── connector.ts        — BrazeConnector class
├── payload.ts          — BrazePayload composition
└── index.ts            — exports for ./braze subpath
```

### Step 2: Implement the connector

```typescript
// packages/esp-connector/src/braze/connector.ts
import {EspConnector, ComposerInput, DispatchAdapter} from '#types'

export class BrazeConnector implements EspConnector<BrazePayload> {
  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async compose(input: ComposerInput): Promise<BrazePayload> {
    // Braze-specific payload shape (different from Klaviyo's)
    return {
      name: input.campaignName,
      template_id: '...', // or create template inline
      segment_id: input.segmentId,
      trigger_properties: {
        personalization_tokens: input.personalizationTokens,
      },
    }
  }

  async dispatch(payload: BrazePayload, adapter: DispatchAdapter): Promise<DispatchResult> {
    // Braze-specific API call
    const response = await brazeFetch('POST', '/api/campaigns/trigger/send', payload)
    return {
      success: response.ok,
      campaignId: payload.name,
      sendId: response.data.send_id,
    }
  }
}

export interface BrazePayload {
  name: string
  template_id: string
  segment_id: string
  trigger_properties: Record<string, unknown>
}
```

### Step 3: Export the subpath

In `packages/esp-connector/package.json`:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./klaviyo": "./src/klaviyo/index.ts",
    "./braze": "./src/braze/index.ts",
    "./types": "./src/types.ts"
  }
}
```

### Step 4: Update the send Function

In `functions/on-promotion-approved/index.ts`:

```typescript
import {KlaviyoConnector} from '@starter/esp-connector/klaviyo'
import {BrazeConnector} from '@starter/esp-connector/braze'

const esp = process.env.ESP_PROVIDER // 'klaviyo' | 'braze'
const connector =
  esp === 'braze'
    ? new BrazeConnector(process.env.BRAZE_API_KEY)
    : new KlaviyoConnector(process.env.KLAVIYO_API_KEY)
```

**The existing Klaviyo code never changes.** You only add new Braze files.

## Dispatch with Retry Logic

The `createPayloadDispatcher()` factory wraps any connector with resilience:

```typescript
import {createPayloadDispatcher} from '@starter/esp-connector'

const dispatcher = createPayloadDispatcher({
  espConnector: new KlaviyoConnector(apiKey),
  maxRetries: 3,
  backoffMs: 1000, // exponential: 1s, 2s, 4s
  timeoutMs: 30000,
})

const result = await dispatcher.dispatch(payload, {
  fetch: globalThis.fetch,
  timeout: 30000,
  maxRetries: 3,
})
```

Retries on:

- Network timeouts
- 5xx status codes
- Transient Klaviyo errors (rate limit, temporary outages)

Does NOT retry on:

- 4xx errors (validation, auth failures)
- Payload structure errors

## Testing the Connector

Unit test template (no external API calls):

```typescript
describe('KlaviyoConnector', () => {
  it('should compose a valid Klaviyo payload', async () => {
    const connector = new KlaviyoConnector('test-key')
    const input: ComposerInput = {
      promotionId: 'promo-1',
      campaignId: 'camp-1',
      segmentId: 'seg-1',
      subjectLine: 'Test Subject',
      preheader: 'Test Preheader',
      htmlBody: '<html></html>',
      disruptor: 'Test Disruptor',
      campaignName: 'Test Campaign',
      segments: ['seg-1'],
      personalizationTokens: {first_name: 'John'},
      brandVoice: {toneTraits: ['friendly']},
    }
    const payload = await connector.compose(input)
    expect(payload.data.attributes.subject_line).toBe('Test Subject')
  })

  it('should handle dispatch errors gracefully', async () => {
    const mockAdapter: DispatchAdapter = {
      fetch: async () => new Response('{}', {status: 500}),
      timeout: 5000,
      maxRetries: 3,
    }
    const connector = new KlaviyoConnector('test-key')
    const result = await connector.dispatch(mockPayload, mockAdapter)
    expect(result.success).toBe(false)
  })
})
```

## Jobs to Be Done

### 1. Extend to a new ESP (Braze, HubSpot, etc.)

- Understand the target ESP's API (template creation, campaign send, list targeting)
- Create `./src/{esp}/client.ts` with API wrappers
- Create `./src/{esp}/connector.ts` implementing `EspConnector<{Esp}Payload>`
- Add export to `package.json#exports`
- Update `functions/on-promotion-approved/` to instantiate the right connector based on config
- Write unit tests for payload composition

### 2. Compose a promotion into an ESP payload

- Given a promotion document, campaign context, and brand voice, call `connector.compose(input)`
- Understand what fields the target ESP requires (subject, template, segment list, etc.)
- Map Sanity field names to ESP field names (Klaviyo `{% variable %}` vs. Braze `{{ variable }}`)

### 3. Dispatch to the ESP with resilience

- Call `createPayloadDispatcher()` wrapping your connector
- Use the dispatcher's `dispatch(payload)` method with retry + timeout behavior
- Log successes and failures; write campaign ID and send ID back to Sanity

### 4. Test the payload before sending

- Call `connector.verify?()` to test-render or validate without triggering a live send
- Useful for the Klaviyo verification preview endpoint

## References

- `packages/esp-connector/src/index.ts` — interface definitions and dispatcher factory
- `packages/esp-connector/src/klaviyo/` — Klaviyo reference implementation
- `functions/on-promotion-approved/index.ts` — send Function entry point
- `packages/esp-connector/src/types.ts` — shared types and interfaces
