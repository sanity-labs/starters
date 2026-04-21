# Email Marketing Operations — Testing Strategy

## Testing Pyramid

### Unit Tests (Base)

**Render pipeline:**

- `renderMjmlStream(promotion)` produces valid HTML
- `sanitizeStream()` removes scripts while preserving email markup
- `StubReplacerStream` handles Handlebars tags across chunk boundaries

**Example:**

```typescript
import {renderMjmlStream} from '@starter/render-email'

describe('renderMjmlStream', () => {
  it('produces valid HTML from MJML input', async () => {
    const promotion = {
      /* ... */
    }
    const chunks = []

    renderMjmlStream(promotion)
      .on('data', (chunk) => chunks.push(chunk))
      .on('end', () => {
        const html = Buffer.concat(chunks).toString()
        expect(html).toContain('<html')
        expect(html).toContain('</html>')
      })
  })

  it('sanitizes script tags', async () => {
    const malicious = '<script>alert("xss")</script><p>Safe</p>'
    const sanitized = DOMPurify.sanitize(malicious, {
      /* ... */
    })
    expect(sanitized).not.toContain('script')
    expect(sanitized).toContain('Safe')
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

**SSRF prevention:**

- Attempt to reference `169.254.169.254` (AWS metadata) — expect 400
- Attempt to reference internal hostname — expect 400
- Verify allow-listed origins are accessible

**Example:**

```typescript
describe('SSRF Prevention', () => {
  it('blocks AWS metadata endpoint', async () => {
    const maliciousPromo = {
      emailSlots: [
        {
          asset: {url: 'http://169.254.169.254/latest/meta-data/'},
        },
      ],
    }

    // Create promotion with malicious URL
    const response = await renderPromotion(maliciousPromo)
    expect(response.status).toBe(400)
    expect(response.body).toContain('Unsafe URL')
  })

  it('allows configured DAM origins', async () => {
    const safePromo = {
      emailSlots: [
        {
          asset: {url: 'https://my-dam.aem.adobe.com/image.jpg'},
        },
      ],
    }

    const response = await renderPromotion(safePromo)
    expect(response.status).toBe(200)
  })
})
```

**Auth tests:**

- Studio OAuth: valid token passes, invalid token fails
- Preview token: valid signature passes, forged signature fails, expired token fails
- Webhook signature: valid HMAC passes, forged HMAC fails, old timestamp fails

## Test Coverage Goals

| Component                                                                  | Type               | Coverage                                                           |
| :------------------------------------------------------------------------- | :----------------- | :----------------------------------------------------------------- |
| `@starter/render-email` (at `packages/@starter/render-email/`)             | Unit               | 85%+ (streaming behavior is hard to mock; integration tests count) |
| `@starter/esp-connector` (at `packages/@starter/esp-connector/`)           | Unit               | 90%+ (payload composition is deterministic)                        |
| `@starter/preview-middleware` (at `packages/@starter/preview-middleware/`) | Unit + Integration | 95%+ (security-critical)                                           |
| Preview service routes                                                     | Integration        | 90%+ (HTTP contract is essential)                                  |
| Content Agent integration                                                  | Integration        | 80%+ (depends on content-agent external service)                   |
| Functions (on-promotion-approved)                                          | Integration        | 85%+ (requires Sanity Functions runtime mock)                      |

## Running Tests

```bash
# Unit tests
pnpm test:unit

# Integration tests (requires local Sanity instance + preview service running)
pnpm test:integration

# Security tests
pnpm test:security

# Load test (k6)
k6 run tests/load-test.js

# All tests with coverage
pnpm test:coverage
```

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
