# Email Marketing Operations — Security

This document describes the security controls that exist in the code today, where they live, and what is deliberately left for you to add before running the starter with real subscribers. Anything in the "Not implemented" section is not wired up; do not rely on it.

## Surfaces

| Surface                     | Location                                         | Who reaches it                                          |
| :-------------------------- | :----------------------------------------------- | :------------------------------------------------------ |
| Klaviyo preview route       | `frontend/app/api/preview/klaviyo/[id]/route.ts` | Studio users and anyone holding a preview link          |
| React preview page          | `frontend/app/promotions/[id]/page.tsx`          | Presentation tool iframe, draft mode                    |
| Live send                   | `functions/on-promotion-approved/index.ts`       | Klaviyo, then every subscriber in the targeted segment  |
| Engagement webhook          | `frontend/app/api/webhooks/engagement/route.ts`  | Klaviyo                                                 |
| Shared renderer and helpers | `packages/render-email/`                         | Preview route (MJML render, sanitizer) and the Function |

## Threat model

1. **HTML injection via Sanity content.** Promotion fields (`subjectLine`, `disruptor`, block `headline`/`body`/`legalText`, product titles, CTA and product URLs) are written by editors, by AI generation, and by anyone with a write token. Whatever reaches the dataset is rendered into HTML for previews and for the live send.
2. **Unauthorized preview access.** Preview links are meant to be shared with reviewers; the route must not be readable by anyone who guesses a document ID.
3. **Webhook forgery.** A forged engagement webhook could write fake metrics into `promotion.campaignPerformance`.
4. **Dangerous link targets.** A `javascript:` or `data:` URL in a CTA would execute in a browser preview and be flagged by mail clients.

## What the code does

### Output escaping at render time (preview and send)

`packages/render-email/src/escape/index.ts` exports two dependency-free helpers:

- `escapeHtml(value)` escapes `& < > " '` so authored text can never open a tag or break out of an attribute.
- `safeHttpUrl(value)` returns the URL only when it parses as absolute `http:` or `https:`; anything else (`javascript:`, `data:`, relative paths) is dropped along with the element that would have used it.

Both renderers use them for every interpolated value:

- The MJML renderer (`packages/render-email/src/index.ts`) behind `renderPromotionLocal` and `renderPromotionKlaviyo`.
- The hand-built HTML in `functions/on-promotion-approved/index.ts`, which is what Klaviyo sends to real subscribers. The Function bundles the helpers from `@starter/render-email/escape` without pulling in mjml.

Klaviyo Handlebars tokens such as `{{ unsubscribe_url }}` are emitted by the templates themselves, never taken from content, so escaping does not interfere with them. Subject line and preheader are sent to Klaviyo as JSON fields, not HTML.

Tests: `packages/render-email/src/escape/escape.test.ts`, the `output escaping` block in `packages/render-email/src/index.test.ts`.

### Whole-document sanitization of the preview

`sanitizeEmailHtml(html)` in `packages/render-email/src/sanitize/index.ts` runs DOMPurify once over the complete rendered document (`WHOLE_DOCUMENT: true`) and additionally forbids `script`, `iframe`, `object`, `embed`, `form`, `input`, `textarea`, `select`, `button`, `base`, and `link`. DOMPurify's defaults remove inline event handlers and non-http(s) URLs. The preview route applies it to the final HTML, whether that HTML came straight from MJML or round-tripped through Klaviyo's template render API.

It deliberately buffers the whole document. An earlier streaming version chunked the input at the last `>` and sanitized each chunk independently, which cannot tell a tag-closing `>` from one inside a quoted attribute; a payload split across the boundary would be sanitized as two harmless fragments. Emails are small, so buffering costs nothing.

The sanitizer is preview-only: Outlook conditional comments (`<!--[if mso]>`) do not survive DOMPurify, so the send path relies on render-time escaping instead.

Tests: `packages/render-email/src/sanitize/sanitize.test.ts` (including the chunk-boundary regression).

### Preview route authentication

`verifyPreviewSecret` in `frontend/app/api/preview/_auth.ts` compares the `sanity-preview-secret` (or `token`) query parameter against `SANITY_PREVIEW_SECRET` using `timingSafeEqual`.

- **Production** (`NODE_ENV=production` or `VERCEL_ENV=production`) with the secret unset: the route refuses every request with HTTP 500 and logs `SANITY_PREVIEW_SECRET is not set; refusing preview requests in production`. The endpoint fails closed rather than silently becoming public.
- **Non-production** with the secret unset: requests are allowed so local development works without setup, and a warning is logged once per process.
- Secret set: a missing or wrong token gets HTTP 401.

The Studio's "Open preview" links (`studio/sanity.config.ts`, `studio/plugins/campaign/views/CampaignGridView.tsx`) are built without a token. Once you set the secret, append `?sanity-preview-secret=<value>` to those links or switch to per-session secrets with `@sanity/preview-url-secret` (see below). Do not put the secret in a `SANITY_STUDIO_*` variable: those are compiled into the public Studio bundle.

### Preview response headers

Every HTML preview response carries `PREVIEW_SECURITY_HEADERS` from `_auth.ts`:

```
Content-Security-Policy: default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

`default-src 'none'` with no `script-src` means that even if markup slipped past the sanitizer, the browser would not execute it. `frame-ancestors 'none'` also means the route cannot be embedded in an iframe; relax it to `'self'` if you build an in-app preview frame. The JSON variant of the route (`Accept: application/json`) returns `{html, previewStatus}` with `Access-Control-Allow-Origin: *` and no CSP, since the caller renders the HTML.

### GROQ parameterization

Document IDs reach GROQ as `$id` parameters (`client.fetch(query, {id})`), never by string interpolation, in the preview route and the Function.

### Engagement webhook signature

`frontend/app/api/webhooks/engagement/route.ts` verifies Klaviyo's HMAC-SHA256 signature (`X-Klaviyo-Request-Signature` over `timestamp + body`) with a five-minute timestamp window and `timingSafeEqual` when `KLAVIYO_WEBHOOK_SECRET` is set. **When the variable is unset the webhook accepts unsigned requests**, including in production. Set it before exposing the route, or apply the same fail-closed pattern the preview route uses.

## Not implemented (recommended hardening)

None of the following exists in the code. Earlier versions of this document described them as if they did.

- **Per-link, expiring preview tokens.** The preview uses one shared secret. `@sanity/preview-url-secret` gives you per-session secrets stored in the dataset and validated by the frontend, so the Studio can mint links without shipping a secret in its bundle.
- **Studio OAuth verification** on the preview route.
- **Webhook secret required.** The engagement webhook fails open when `KLAVIYO_WEBHOOK_SECRET` is unset.
- **SSRF allow-listing of asset hosts.** Only the URL scheme is checked. Exposure is low because the frontend never fetches content URLs server-side (image URLs come from `cdn.sanity.io` asset references; CTA and product URLs are links for the recipient), but if you add server-side fetching of authored URLs, add a host allow-list first.
- **Rate limiting and request coalescing** on the preview route. Each request that has `KLAVIYO_API_KEY` set creates, renders, and deletes a Klaviyo template.
- **Structured audit logging** and CSP violation reporting.
- **Schema-level input validation** beyond Sanity's own `url` type (which allows only http/https in the Studio; the renderers enforce the same rule for content written through the API).

## Configuration checklist

- [ ] `SANITY_PREVIEW_SECRET` set in every deployed frontend environment (the route returns 500 in production without it). Generate with `openssl rand -hex 32`.
- [ ] Studio preview links carry the secret, or `@sanity/preview-url-secret` is wired in.
- [ ] `KLAVIYO_WEBHOOK_SECRET` set wherever the engagement webhook is exposed.
- [ ] `SANITY_API_READ_TOKEN` is a Viewer token; the write token for the webhook (`SANITY_API_WRITE_TOKEN`) is scoped to the dataset.
- [ ] `KLAVIYO_API_KEY` scoped as described in the README (Lists/Segments read, Templates/Campaigns read/write).
- [ ] Frontend served over HTTPS; the route sets HSTS but TLS termination is the host's job.

## Verifying

```bash
pnpm test        # escape, sanitize, and renderer tests
```

There is no automated test for the preview route's authentication; exercise it manually with and without `SANITY_PREVIEW_SECRET` and with `NODE_ENV=production`.
