# Email Marketing Operations — Security Hardening

## Threat Model

The preview service is attacker-adjacent by design: it renders Sanity-authored content and serves preview links to external reviewers. Threats:

1. **XSS via Sanity content** — attacker controls promotion fields (via Studio breach or via API) and injects `<script>` tags
2. **SSRF** — attacker references internal metadata endpoints via image URLs or asset refs
3. **Unauthorized preview** — attacker crafts unsigned preview tokens to see content without permission
4. **Rate-limit abuse** — attacker hammers Klavioy API (expensive) via preview renders
5. **Webhook signature forgery** — attacker injects fake engagement metrics
6. **CSP bypass** — attacker finds a way to load/execute scripts in preview context
7. **Session hijacking** — attacker steals a Studio OAuth cookie and calls preview endpoints

## Seven-Layer Defense

### 1. Transport: HTTPS + HSTS

**Configuration:**

```javascript
// Express middleware
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  next()
})
```

**Effect:** Browser enforces HTTPS for all future requests to this domain; prevents downgrade attacks.

### 2. Authentication (3 Paths, No Fallback)

#### Path A: Studio Session (OAuth)

**Usage:** Internal calls from Studio (grid tiles, 1:1 preview during authoring).

**Implementation:**

```typescript
import {createClient} from '@sanity/client'

const client = createClient({
  // OAuth token from browser session
  token: req.headers.authorization?.replace('Bearer ', ''),
})

// Verify token is valid and scoped to this org
const verified = await client.auth.verify()
if (!verified) return res.status(401).send('Unauthorized')
```

**Flow:**

1. Studio sends `Authorization: Bearer {oauth_token}`
2. Preview service calls Sanity `GET /auth/verify` with token
3. If valid and org-scoped, allow; otherwise reject 401

#### Path B: Preview URL Secret (Signed Token)

**Usage:** Shareable preview links for external reviewers; time-boxed.

**Implementation:**

```typescript
import {verifyRequestSignature} from '@sanity/preview-url-secret'

const token = req.query.token // PASETO or JWT ES256 signed
const signature = req.query.sig

const verified = verifyRequestSignature(token, signature, {
  secret: process.env.SANITY_PREVIEW_SECRET, // Ed25519 private key
  algorithm: 'PASETO',
  clockTolerance: 30, // seconds
})

if (!verified) return res.status(401).send('Invalid token')

// Decode token claims
const claims = decodeToken(token) // { documentId, embeddingOrigin, exp, jti }
if (Date.now() > claims.exp * 1000) return res.status(401).send('Token expired')
```

**Token claims:**

- `documentId` — scoped to one promotion
- `embeddingOrigin` — embedding domain (used for CSP `frame-ancestors`)
- `exp` — expiration (Unix timestamp)
- `jti` — unique ID (checked against revocation deny-list)

**Revocation:** Keep a deny-list (Redis) of revoked JTIs; check on every request.

#### Path C: Webhook Signature (HMAC-SHA256)

**Usage:** Inbound engagement webhooks from ESP.

**Implementation:**

```typescript
import crypto from 'crypto'

function verifyKlaviyoSignature(body, signature, apiKey) {
  const timestamp = req.headers['x-klaviyo-request-timestamp'] // Unix seconds
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
    throw new Error('Timestamp outside 5-minute window')
  }

  const data = `${timestamp}.${body}` // String concatenation
  const hash = crypto.createHmac('sha256', apiKey).update(data).digest('base64')

  // Use timingSafeEqual to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature))
}
```

**Note:** Each ESP has different signature algorithms. Implement per-ESP.

#### No Fallback

If a request doesn't match **all three** auth paths, return 401. No anonymous rendering.

### 3. Input Validation

**Zod schemas:**

```typescript
import {z} from 'zod'

const PreviewParamsSchema = z.object({
  promotionId: z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),
  viewport: z.enum(['mobile', 'desktop']).optional(),
  version: z.string().regex(/^\d+$/).optional(),
})

const parsed = PreviewParamsSchema.safeParse(req.query)
if (!parsed.success) {
  return res.status(400).json({error: 'Invalid parameters', issues: parsed.error.issues})
}
```

**Document ID whitelist:** Prevent traversal attacks (`../../../etc/passwd` via ID).

**GROQ parameterization:** Never interpolate document IDs directly into GROQ.

```typescript
// Good
const promo = await client.fetch(`*[_id == $id][0]`, {id: promotionId})

// Bad
const promo = await client.fetch(`*[_id == "${promotionId}"][0]`) // SQL injection equivalent
```

### 4. Render-Time Defenses

#### SSRF Prevention

**Allow-list approach:**

```typescript
const ALLOWED_ORIGINS = [
  'cdn.sanity.io',
  'images.klaviyo.com',
  'my-dam.aem.adobe.com', // Configured
]

const BLOCKED_HOSTS = [
  '169.254.169.254', // AWS metadata
  'metadata.google.internal', // GCP metadata
  'metadata.azure.com', // Azure metadata
]

function isSafeUrl(url) {
  const parsed = new URL(url)

  // Check blocked hosts
  if (BLOCKED_HOSTS.includes(parsed.hostname)) return false

  // Check allow-list
  const isAllowed = ALLOWED_ORIGINS.some((origin) => parsed.hostname.endsWith(origin))
  if (!isAllowed) return false

  return true
}
```

Use this in MJML and Portable Text serializers; reject unsafe asset URLs before rendering.

#### HTML Sanitization

**DOMPurify with email config:**

```typescript
import DOMPurify from 'isomorphic-dompurify'

const sanitized = DOMPurify.sanitize(html, {
  ALLOWED_TAGS: ['p', 'div', 'span', 'a', 'img', 'table', 'tr', 'td', 'h1', 'h2', 'h3'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'width', 'height', 'align'],
  KEEP_CONTENT: true,
  // Email-specific: don't allow event handlers, scripts, or frames
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
})
```

**Application:** Sanitize Portable Text output BEFORE stub replacement (prevents attacker-provided content that looks like a Klavioy tag from being styled as one).

#### Handlebars, Not eval()

Preserve Handlebars syntax as static text in stubs — never evaluate it.

```typescript
// Good
const stubbed = html.replace(
  /{% coupon_code %}/g,
  '<preview-stub>Resolves at send time</preview-stub>',
)

// Bad (don't do this!)
const evaluated = eval(html) // 🔥
```

### 5. Output Headers (Every Response)

```typescript
app.use((req, res, next) => {
  // CSP: no scripts, no frames, no forms
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'none'",
      'img-src https: data:',
      "style-src 'unsafe-inline' https:", // Email CSS is inline; unavoidable
      'font-src https: data:',
      "script-src 'none'",
      `frame-ancestors ${getFrameAncestors(req)}`, // Dynamic per token
      "form-action 'none'",
      "base-uri 'none'",
      "object-src 'none'",
    ].join('; '),
  )

  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer') // Preview tokens don't leak in Referer
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN') // Fallback for non-CSP browsers
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')

  next()
})
```

**`frame-ancestors` is dynamic:**

```typescript
function getFrameAncestors(req) {
  const token = req.query.token
  const claims = decodeToken(token) // { embeddingOrigin }

  // No wildcards
  if (claims.embeddingOrigin === 'https://studio.sanity.io') {
    return "'self'"
  }
  return `'none'` // Don't allow embedding by default
}
```

**`script-src 'none'` is critical:** If XSS sneaks through sanitization, it cannot escalate to script execution.

### 6. Rate Limiting (Three Tiers)

#### Per-IP Global

```typescript
import RedisStore from 'rate-limit-redis'
import rateLimit from 'express-rate-limit'

const globalLimiter = rateLimit({
  store: new RedisStore({client: redis, prefix: 'rl:ip:'}),
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  keyGenerator: (req) => req.ip,
  skip: (req) => req.user?.isAdmin, // Optional: skip for admins
})

app.use(globalLimiter)
```

#### Per-Token

```typescript
const tokenLimiter = rateLimit({
  store: new RedisStore({client: redis, prefix: 'rl:token:'}),
  windowMs: 60 * 1000,
  max: 10, // 10 renders per token per minute
  keyGenerator: (req) => req.query.token,
})

app.get('/v1/render/local/:id', tokenLimiter, renderLocalHandler)
```

#### Per-Document (Request Coalescing)

```typescript
const requestCache = new Map() // { 'endpoint:docId:hash' => Promise<result> }

async function renderWithCoalescing(promotionId) {
  const contentHash = await client.fetch(`*[_id == $id][0]._rev`, {id: promotionId})
  const cacheKey = `render:${promotionId}:${contentHash}`

  // If same request is in-flight, reuse it
  if (requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey)
  }

  // Otherwise, fetch and cache
  const promise = fetchAndRender(promotionId)
  requestCache.set(cacheKey, promise)

  try {
    return await promise
  } finally {
    requestCache.delete(cacheKey) // Clean up after TTL
  }
}
```

**Effect:** Five reviewers open the same preview link at once → one upstream Klavioy API call, not five.

### 7. Logging & Audit

```typescript
import winston from 'winston'

const logger = winston.createLogger({
  transports: [new winston.transports.File({filename: 'audit.log', level: 'info'})],
})

app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    logger.info({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      ip: req.ip,
      duration: Date.now() - start,
      promotionId: req.query.promotionId, // Only if auth succeeded
      // REDACT: token, signature, previewContext values
    })
  })
  next()
})
```

**Security audit stream** (alerts):

- Auth failures (which path, which reason)
- Rate limit breaches
- Webhook signature mismatches (ESP misconfig or attack)
- SSRF attempts (blocked asset URLs)
- CSP violations (browser reports via `report-to`)

**Never log:**

- Authorization header
- Preview tokens or signatures
- `previewContext` field values (may contain PII)
- Rendered HTML bodies

## Configuration Checklist

- [ ] HTTPS enabled; HSTS preload pending
- [ ] OAuth verify endpoint wired up
- [ ] Preview token signing key (`SANITY_PREVIEW_SECRET`) rotated and in secure vault
- [ ] ESP webhook algorithms implemented for each ESP (Klavioy HMAC-SHA256, Braze signed JWT, etc.)
- [ ] DOMPurify allow-list configured for email HTML
- [ ] SSRF allow-list matches actual DAM origins and asset CDNs
- [ ] Rate-limit Redis cluster provisioned; keys prefixed by service
- [ ] Audit logging sends to secure log aggregation (CloudWatch, Datadog, etc.)
- [ ] CSP report-to endpoint wired up (collects CSP violations)
- [ ] Preview token revocation deny-list implemented and checked on every request
- [ ] Monitoring alerts for 401/403 spikes, rate-limit breaches, webhook signature failures
