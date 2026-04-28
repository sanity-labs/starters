# ESP notes — what Resend does and doesn't do

This starter dispatches email through [Resend](https://resend.com/). Resend is an excellent transactional/broadcast API, but it is not a behavioral marketing platform. Some capabilities that exist in Klaviyo, Braze, Iterable, etc. simply have no Resend equivalent. This document is the canonical place to look when you wonder _"why doesn't the starter do X?"_.

## Functional gaps

### No behavioral or dynamic segments

Resend Segments are **static contact lists**. You push contacts into them; they don't update based on user behavior, properties, or filter rules.

There is no equivalent to Klaviyo's filter-based segments (`Placed Order in last 30 days AND $value > 100`).

**If you need dynamic segmentation:** implement it in a Sanity Function. Read contacts/events from your CDP or warehouse, compute membership, and use `resend.contacts.create()` / `resend.contacts.remove()` to maintain a Resend Segment as a materialized view.

### No flows, automations, or journeys

Resend has no triggered-campaign concept (e.g. "send Day 0, Day 3, Day 7 of an onboarding sequence based on signup event"). This is out of scope for Resend.

**If you need flows:** orchestrate them in your application code or in a workflow tool (Vercel Workflow, Inngest, Trigger.dev) and call `resend.broadcasts.send()` from each step.

### No metric-event ingestion

Resend webhooks are **delivery-side only**: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`. There is no API to log custom events like `Placed Order` or `Added to Cart`.

This is why this starter's `promotion.campaignPerformance` schema has no source for `conversionRate` — Resend cannot tell you that a recipient converted, only that they opened or clicked.

### No server-side template render API

Klaviyo's `/api/template-render/` endpoint let you ask Klaviyo to render a template against sample data and return HTML — useful for "preview as the ESP will send it". Resend has no equivalent.

This starter renders preview HTML **locally** via `@react-email/render` in `frontend/app/api/preview/resend/[id]/route.ts`. The response carries `X-Preview-Status: local-render` to make this explicit. Functionally this is fine: Resend accepts whatever HTML you give it, so local render and send-time render are the same render.

### No A/B testing

Klaviyo had built-in subject-line / send-time A/B tests. Resend does not. If you need A/B testing, generate two promotions targeting halves of a Segment and compare `campaignPerformance` after the fact.

## If you need `conversionRate`

The schema field exists in `studio/plugins/promotion/schemaTypes/promotion.ts` (look for `campaignPerformance.conversionRate`). It is not currently populated by anything because Resend has no event ingestion path.

To wire it from an external source (analytics, CDP, warehouse), add a new event type to the existing engagement webhook handler at:

> `frontend/app/api/webhooks/engagement/route.ts`

Suggested approach:

1. Stand up a second webhook endpoint (or extend the same one) that accepts events from your CDP/analytics tool. Common shapes: Segment Personas, RudderStack, GA4 Measurement Protocol, a custom server event.
2. Verify the inbound signature against your CDP's signing scheme (this will not be Svix — Svix is Resend-specific).
3. Map the event's `email` or `userId` back to a `promotion._id`. The simplest path is: include a UTM parameter or query string on every CTA link in the email (e.g. `?utm_campaign=<promotionId>`), then read it on the server-side conversion event.
4. Increment `promotion.campaignPerformance.conversionRate` (or whatever counter you want) via a Sanity client patch, mirroring how `openRate++` and `clickThroughRate++` are handled today.

Keep this code path separate from the Resend-Svix verification block — they handle different inputs and must not share signature logic.

## What Resend does well that this starter uses

- **Broadcasts API** with `segmentId` targeting in two API calls (`broadcasts.create` then `broadcasts.send`). No template lifecycle to manage.
- **Svix-verified webhooks** for delivery, open, click, bounce, complaint. Standard, signed, replay-resistant.
- **React Email** as a first-class render input. The `react:` field on `emails.send` accepts JSX directly; broadcasts accept rendered HTML via `html:`.
- **Domain verification with SPF + DKIM** as a hard prerequisite for sending. Good deliverability hygiene by default.

## References

- [Resend `llms.txt`](https://resend.com/llms.txt) — canonical AI entry point, links to OpenAPI and SDK docs
- [Resend docs](https://resend.com/docs)
- `frontend/app/api/webhooks/engagement/route.ts` — webhook handler (the place to add custom event types if you need conversion tracking)
- `functions/on-promotion-approved/index.ts` — broadcast send
- `functions/import-resend-segments/index.ts` — segment sync
