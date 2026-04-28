# Resend cheatsheet

Verified against Resend Node SDK **v6.12.x** as of 2026-04-28. If working in a future session, refresh against `https://resend.com/llms.txt` first — Resend's API surface evolves and your training data may be wrong. Pin a major version in `package.json` (e.g. `^6.12.0`), don't write "latest".

## Canonical AI entry point

```
https://resend.com/llms.txt
```

This is a curated index of everything an AI agent needs: OpenAPI spec, SDK docs, MCP server, CLI, examples. Always fetch this first.

## Node SDK

```ts
import {Resend} from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
```

The SDK package is `resend` on npm (no scope). It bundles types.

### Transactional send

```ts
await resend.emails.send({
  from: 'Brand <updates@example.com>',  // verified domain required
  to: ['user@example.com'],
  subject: 'Subject',
  html: '<p>...</p>',
  // OR
  react: <EmailComponent prop="value" />,  // react-email component
})
```

`react:` is the smoothest path when the project authors templates as React components. `html:` is fine when HTML is already built (this starter currently builds HTML via the `buildHtml` helper in `on-promotion-approved`).

### Bulk / Broadcasts (Klaviyo "campaign" equivalent)

```ts
const broadcast = await resend.broadcasts.create({
  segmentId: 'seg_123', // Resend Segment id (REQUIRED)
  name: 'Campaign label',
  from: 'Brand <updates@example.com>',
  subject: 'Subject',
  previewText: 'Optional preheader', // top-level field, supported in v6.x
  html: '<p>...</p>', // OR react: <Component/>
  scheduledAt: undefined, // ISO 8601 to schedule
})

if (!broadcast.data?.id) throw new Error('broadcast create failed')
await resend.broadcasts.send(broadcast.data.id)
```

**Important v6.x notes:**

- `audienceId` is deprecated. Only `segmentId` is valid on `broadcasts.create`. (Audiences linger as a deprecated field on `contacts.list` only.)
- `previewText` _is_ supported as a top-level field on `broadcasts.create` (despite some older docs saying otherwise). Pass `promotion.preheader` here.
- The SDK return shape is `{data: {id}, error}`, not `{id}` directly. Check `error` first or `data?.id`.
- Optional one-shot: `broadcasts.create({...})` accepts `send: true` to fold create+send. Two calls is clearer when you need to persist the id between them.

### Segments (Klaviyo "list/segment" equivalent — but static only)

```ts
const segments = await resend.segments.list()
const segment = await resend.segments.create({name: 'VIP'})
const single = await resend.segments.get('seg_123')
```

**There is no dynamic/filter-based segmentation API.** Segments are named lists you push contacts into. If you need behavioral segmentation, do it in Sanity Functions.

### Contacts (Klaviyo "profile" equivalent)

```ts
await resend.contacts.create({
  email: 'user@example.com',
  segmentId: 'seg_123',
  unsubscribed: false,
  firstName: 'Ada',
  lastName: 'Lovelace',
})

const list = await resend.contacts.list({segmentId: 'seg_123'})
await resend.contacts.update({id: 'con_123', firstName: 'Ada'})
await resend.contacts.remove({id: 'con_123', segmentId: 'seg_123'})
```

`memberCount` for a segment is derived by listing contacts and counting (paginate if needed).

## Webhook verification (Svix)

Resend webhooks are signed via Svix. **Verify on the raw request body**, not parsed JSON. Resend sends **one event per request** (single object, not an array — different from Klaviyo's batched-events shape).

```ts
import {Resend} from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const rawBody = await req.text()
  const headers = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  }

  try {
    resend.webhooks.verify({
      payload: rawBody,
      headers,
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    })
  } catch {
    return new Response('Unauthorized', {status: 401})
  }

  const event = JSON.parse(rawBody)
  // event.type: 'email.opened' | 'email.clicked' | 'email.bounced' | 'email.delivered' | 'email.delivery_delayed' | 'email.complained'
  // event.data: { email_id, broadcast_id?, to, subject, ... }
}
```

Svix verifier rejects payloads older than 5 minutes by default — same window we had with Klaviyo's HMAC dance.

### Event types you'll care about

| Event                    | Map to existing field               |
| ------------------------ | ----------------------------------- |
| `email.opened`           | `openRate++`                        |
| `email.clicked`          | `clickThroughRate++`                |
| `email.bounced`          | bounce log (not currently surfaced) |
| `email.delivery_delayed` | (ignore)                            |
| `email.complained`       | (consider as unsubscribe-adjacent)  |
| `email.delivered`        | (delivery confirmation)             |

There is **no purchase/conversion event** from Resend. The current `Placed Order` → `conversionRate` mapping has no equivalent — drop it or document as an external-event hook.

## Required environment variables

| Var                     | Where                                                           | Purpose                                           |
| ----------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| `RESEND_API_KEY`        | Function runtime (`sanity functions env add`) + frontend `.env` | API auth                                          |
| `RESEND_WEBHOOK_SECRET` | Frontend `.env`                                                 | Svix webhook verification                         |
| `RESEND_FROM_EMAIL`     | Function runtime + frontend `.env`                              | The `from` address (must be on a verified domain) |
| `RESEND_DOMAIN`         | Function runtime (optional)                                     | Plain domain name, useful for logging/UX          |

API keys look like `re_…`.

## Domain verification (mandatory)

Resend will not send email until your domain has SPF + DKIM records published.

1. Resend Dashboard → Domains → Add Domain → enter `example.com` (or subdomain like `updates.example.com`).
2. Resend gives you ~3 DNS records (SPF TXT, DKIM TXT, optional DMARC TXT).
3. Add to your DNS provider. Wait for verification (minutes to hours).
4. Once verified, send `from: '… <updates@example.com>'`.

For local dev / dogfood: you can send to _any_ address from the Resend onboarding sandbox `from: 'onboarding@resend.dev'` — limited to your own account email. Use this if domain verification is blocking the live send test.

## Resend MCP server (optional)

```bash
npx -y resend-mcp
```

This is an **action MCP**, not a docs MCP. It lets an agent operate the Resend API at runtime — send emails, manage contacts, list broadcasts. Useful for:

- The verification step's live send test (have an agent send a test email).
- Future agent-driven sending, list management.

It is **not** useful for looking up Resend docs — there are no `search_docs`/`read_docs` tools. Use WebFetch on `resend.com/llms.txt` and `resend.com/docs/*` for that.

Auth: requires `RESEND_API_KEY` in the MCP server's env.

## Common pitfalls

- **Verifying on parsed JSON** — Svix verification needs the _raw_ request body. Stringifying/re-stringifying the parsed body breaks the signature.
- **Forgetting `from` is verified** — sending from an unverified domain returns a clear error from Resend, but the error message can mislead agents into chasing API key issues.
- **Confusing Audiences with Segments** — older Resend docs use "Audience" everywhere. The current API exposes both for back-compat, but Segments is the path forward. Prefer `segmentId` over `audienceId` on broadcasts.
- **Treating Resend Segments as dynamic** — they are static lists. There is no `definition` field equivalent to Klaviyo's segment filter JSON.
- **Merge tag syntax** — Resend uses `{{{RESEND_UNSUBSCRIBE_URL}}}` (triple-brace). Klaviyo's `{{ unsubscribe_url }}` will _not_ be substituted by Resend.
