# Email Marketing Operations — Testing Strategy

## Testing Pyramid

### Unit Tests (Base)

**Render pipeline** (`packages/render-email/src/**/*.test.ts`, run with `pnpm test`):

- `renderPromotionLocal` / `renderPromotionKlaviyo` produce HTML containing every block's content, resolve preview-context tokens, and keep Klaviyo tokens for the send path
- `output escaping`: hostile field values (`<script>`, attribute-breaking quotes, `javascript:`/`data:` URLs) never reach the output unescaped
- `escapeHtml` / `safeHttpUrl`: the escaping table and the http(s)-only URL rule
- `sanitizeEmailHtml`: strips scripts, event handlers, forms, and non-http(s) URLs from a whole document while preserving `<html>/<head>/<style>`, tables, and Handlebars tokens; includes the regression for a `>` inside a quoted attribute that defeated chunk-wise sanitizing
- `stubKlaviyoTags` / `resolvePreviewContext` / `buildPreviewStatus`: stub replacement and accuracy metadata

**Example:**

```typescript
import {renderPromotionKlaviyo} from '@starter/render-email'
import {sanitizeEmailHtml} from '@starter/render-email/sanitize'

describe('preview HTML', () => {
  it('never ships authored markup', async () => {
    const html = await renderPromotionKlaviyo({
      emailSlots: [{_type: 'emailSection', headline: '<script>alert(1)</script>'}],
    })
    expect(html).not.toContain('<script>')
  })

  it('sanitizes the whole document once', () => {
    const out = sanitizeEmailHtml('<html><body><img src="x>y" onerror="alert(1)"></body></html>')
    expect(out).not.toContain('onerror')
  })
})
```

**Middleware:**

- `verifyRequestSignature()` rejects forged webhook signatures
- `authMiddleware()` accepts Studio OAuth and preview tokens, rejects others

**Example:**

```typescript
describe('verifyKlaviyoSignature', () => {
  it('accepts valid HMAC signatures within time window', () => {
    const timestamp = Math.floor(Date.now() / 1000)
    const body = JSON.stringify({event: 'open'})
    const data = `${timestamp}.${body}`
    const signature = crypto.createHmac('sha256', apiKey).update(data).digest('base64')

    expect(verifyKlaviyoSignature(body, signature, timestamp, apiKey)).toBe(true)
  })

  it('rejects signatures outside 5-minute window', () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600 // 10 minutes ago
    expect(() => verifyKlaviyoSignature(body, sig, oldTimestamp, apiKey)).toThrow()
  })
})
```

### Integration Tests (Middle)

**End-to-end preview rendering:**

- Fetch promotion + campaign from Sanity
- Render local MJML
- Verify accuracy badge matches resolved tokens
- Test across mobile and desktop viewports

**Example:**

```typescript
describe('End-to-end preview', () => {
  it('renders promotion with accuracy badge', async () => {
    const promotionId = 'promotion-test-123'
    const response = await fetch(`http://localhost:3000/v1/render/local/${promotionId}?token=...`)

    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('<html')

    const badge = response.headers.get('X-Preview-Status')
    const {resolved, stubbed} = JSON.parse(badge)
    expect(resolved + stubbed).toBeGreaterThan(0)
  })

  it('rejects unsigned preview links', async () => {
    const response = await fetch(`http://localhost:3000/v1/render/local/promo-id?token=bad`)
    expect(response.status).toBe(401)
  })
})
```

**Engagement webhook ingestion:**

- Send fake webhook from ESP
- Verify `promotion.campaignPerformance` updated
- Check signature verification blocks forged webhooks

**Example:**

```typescript
describe('Engagement webhook', () => {
  it('updates campaignPerformance on valid webhook', async () => {
    const timestamp = Math.floor(Date.now() / 1000)
    const body = JSON.stringify({
      events: [
        {
          type: 'email_open',
          promotion_id: 'promotion-test-123',
          timestamp,
        },
      ],
    })
    const signature = signKlaviyoPayload(timestamp, body, apiKey)

    const response = await fetch('http://localhost:3000/v1/webhook/engagement/klaviyo', {
      method: 'POST',
      headers: {
        'X-Klaviyo-Request-Timestamp': timestamp,
        'X-Klaviyo-Request-Signature': signature,
        'Content-Type': 'application/json',
      },
      body,
    })

    expect(response.status).toBe(200)

    // Verify Sanity document updated
    const promo = await client.fetch(`*[_id == $id][0].campaignPerformance`, {
      id: 'promotion-test-123',
    })
    expect(promo.openCount).toBeGreaterThan(0)
  })
})
```

### Performance & Load Tests (Observability)

**Grid rendering (batch SSE):**

- 100 promotions in one campaign
- Measure TTFB and per-tile render time
- Verify no tiles are dropped or duplicated

**Concurrent preview renders:**

- 5 tabs simultaneously opening the same preview link
- Verify request coalescing reduces upstream calls to 1
- Check no 429 rate-limit errors

**Example (k6/Apache JMeter):**

```javascript
import http from 'k6/http'
import {check, sleep} from 'k6'

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95th percentile < 500ms
    http_req_failed: ['rate<0.01'], // <1% failure
  },
}

export default function () {
  const promotionId = 'promotion-load-test'
  const token = generatePreviewToken(promotionId)

  const response = http.get(`http://localhost:3000/v1/render/local/${promotionId}?token=${token}`)

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 1s': (r) => r.timings.duration < 1000,
  })

  sleep(1)
}
```

### Security Tests

**CSP compliance:**

- Verify no `unsafe-eval` or `unsafe-inline script-src`
- Verify `frame-ancestors` matches token claim
- Test with CSP violation reporter enabled (collect violations, don't enforce)

**URL scheme guard** (implemented, unit-tested in `escape.test.ts` and `index.test.ts`):

- `javascript:`, `data:`, `vbscript:`, and relative URLs in CTA, product, image, and logo fields are dropped together with the element that would use them
- http(s) URLs pass through attribute-escaped (`&` becomes `&amp;`)

**SSRF host allow-listing** is not implemented; the frontend never fetches authored URLs server-side, so there is nothing to allow-list yet. If you add server-side fetching, add the allow-list and the tests below first:

```typescript
describe('SSRF Prevention', () => {
  it('blocks the AWS metadata endpoint', () => {
    expect(isAllowedAssetHost('http://169.254.169.254/latest/meta-data/')).toBe(false)
  })

  it('allows configured DAM origins', () => {
    expect(isAllowedAssetHost('https://my-dam.aem.adobe.com/image.jpg')).toBe(true)
  })
})
```

**Preview auth** (not automated; verify manually):

- With `SANITY_PREVIEW_SECRET` set: wrong or missing `?sanity-preview-secret=` returns 401
- With it unset and `NODE_ENV=production`: every request returns 500 and the server logs the missing variable
- With it unset in development: requests succeed and a warning is logged once

**Auth tests:**

- Studio OAuth: valid token passes, invalid token fails
- Preview token: valid signature passes, forged signature fails, expired token fails
- Webhook signature: valid HMAC passes, forged HMAC fails, old timestamp fails

## Test Coverage Goals

| Component                                                                  | Type               | Coverage                                         |
| :------------------------------------------------------------------------- | :----------------- | :----------------------------------------------- |
| `@starter/render-email` (at `packages/render-email/`)                      | Unit               | 85%+ (renderer, escaping, sanitizer, stubs)      |
| `@starter/esp-connector` (at `packages/@starter/esp-connector/`)           | Unit               | 90%+ (payload composition is deterministic)      |
| `@starter/preview-middleware` (at `packages/@starter/preview-middleware/`) | Unit + Integration | 95%+ (security-critical)                         |
| Preview service routes                                                     | Integration        | 90%+ (HTTP contract is essential)                |
| Content Agent integration                                                  | Integration        | 80%+ (depends on content-agent external service) |
| Functions (on-promotion-approved)                                          | Integration        | 85%+ (requires Sanity Functions runtime mock)    |

## Running Tests

```bash
# Unit tests (vitest projects: render-email, functions, studio)
pnpm test
pnpm test:watch

# End-to-end tests (Playwright; needs Studio + frontend running, see e2e/.env.example)
pnpm e2e
pnpm e2e:headed
```

The integration, load, and coverage commands described elsewhere in this document are guidance for what to add, not scripts that exist in `package.json`.

## Continuous Integration

**On every commit:**

- Unit tests (fast, no external dependencies)
- Linting (ESLint, TypeScript strict mode)
- Security audit (`npm audit`)

**On PR to main:**

- All unit + integration tests
- Coverage check (must maintain 80%+)
- Security scanning (OWASP ZAP or Snyk)

**On merge to main:**

- Full test suite
- Load test (baseline comparison)
- Staging deployment with smoke tests

## Test Data

**Fixtures:**

- `tests/fixtures/promotion.json` — sample promotion document
- `tests/fixtures/campaign.json` — sample campaign brief
- `tests/fixtures/segment.json` — sample CDP segment
- `tests/fixtures/brand-voice.json` — sample brand guidelines

**Seeding:**

```bash
# Seed Sanity test project with fixtures
pnpm seed:test
```

## Mocking Strategy

**Sanity client:** Mock `client.fetch()` to return fixtures.

```typescript
jest.mock('@sanity/client', () => ({
  createClient: jest.fn(() => ({
    fetch: jest.fn((query, params) => {
      if (params.id === 'promotion-test-123') {
        return require('./fixtures/promotion.json')
      }
      throw new Error('Not found')
    }),
  })),
}))
```

**ESP API:** Mock HTTP responses (prevent real webhook hits during tests).

```typescript
jest.mock('node-fetch')
fetch.mockResolvedValueOnce({
  status: 200,
  json: () => ({campaignId: 'mock-campaign-id'}),
})
```

**Content-agent:** Mock thread API responses.

```typescript
jest.mock('@starter/content-agent-client', () => ({
  createStudioAgent: jest.fn(() => ({
    sendMessage: jest.fn().mockResolvedValue({
      content: 'Refined subject line',
      metadata: {suggestions: {subjectLine: '...'}},
    }),
  })),
}))
```

Do NOT mock Sanity Functions runtime or preview middleware auth/rate-limit logic — those are security-critical and must be integration-tested.
