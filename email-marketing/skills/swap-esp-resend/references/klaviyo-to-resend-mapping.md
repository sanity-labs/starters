# Klaviyo → Resend concept map

## At a glance

| Klaviyo concept                                             | Resend equivalent                             | Notes                                                                                                                                                                                                          |
| ----------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List                                                        | Segment                                       | Resend rolled Audiences into Segments. Static lists only.                                                                                                                                                      |
| Segment (dynamic, filter-based)                             | **none**                                      | No equivalent. Resend Segments are static. Implement filtering in Sanity Functions if needed.                                                                                                                  |
| Profile                                                     | Contact (with optional Contact Properties)    |                                                                                                                                                                                                                |
| Campaign                                                    | Broadcast                                     | `scheduled_at`, `segmentId`, personalization supported.                                                                                                                                                        |
| Template (server-stored)                                    | **none**                                      | Render react-email components locally; pass `html:` or `react:` per send. No template lifecycle to manage.                                                                                                     |
| Flow / automation / journey                                 | **none**                                      | Out of scope for Resend.                                                                                                                                                                                       |
| Metric event (e.g. "Placed Order")                          | **none**                                      | Webhooks are delivery-side only (open/click/bounce/delivered/complained).                                                                                                                                      |
| `{{ unsubscribe_url }}` (double-brace)                      | `{{{RESEND_UNSUBSCRIBE_URL}}}` (triple-brace) | Different name AND different syntax.                                                                                                                                                                           |
| `{% catalog %}` blocks                                      | **none**                                      | Bring your own HTML — Resend won't fetch product feeds. Already handled in this starter (catalog data is fetched in the function before render).                                                               |
| Render API (`/template-render/`)                            | **none**                                      | Local render via `@react-email/render`. The Klaviyo preview route's accuracy badge becomes meaningless — drop it or set to `"local-render"`.                                                                   |
| HMAC-SHA256 webhook signing                                 | Svix                                          | Different headers (`svix-id`/`svix-timestamp`/`svix-signature`), different verification API. Verify on raw body.                                                                                               |
| `X-Klaviyo-Request-Signature` header                        | `svix-signature` header                       |                                                                                                                                                                                                                |
| `klaviyo-api` Node SDK                                      | `resend` Node SDK                             | Different shape: Klaviyo SDK exposes `ApiKeySession` + per-resource API classes (`TemplatesApi`, `CampaignsApi`); Resend SDK is `new Resend(apiKey).emails`/`.broadcasts`/`.segments`/`.contacts`/`.webhooks`. |
| `https://www.klaviyo.com/campaign/{id}/reports` (deep link) | `https://resend.com/broadcasts/{id}`          | Used in the "Open in ESP" Studio action.                                                                                                                                                                       |

## Send-flow comparison

### Klaviyo (current)

```
buildHtml(promotion)
  → templatesApi.createTemplate({ name, html, editorType: 'CODE' })
  → campaignsApi.createCampaign({ audiences: { included: [segmentId] }, campaignMessages: {...} })
  → campaignsApi.getMessageIdsForCampaign(campaignId)
  → campaignsApi.assignTemplateToCampaignMessage(messageId, templateId)
  → campaignsApi.createCampaignSendJob(campaignId)
```

Five round trips. The template + campaign + message split is a Klaviyo-ism.

### Resend (target)

```
buildHtml(promotion)  // unchanged
  → resend.broadcasts.create({ segmentId, from, subject, html })
  → resend.broadcasts.send(broadcast.id)
```

Two round trips. No template lifecycle.

The persisted ID (`promotion.externalCampaignId`) becomes the Resend `broadcast.id` instead of the Klaviyo `campaign.id`. Schema field name unchanged.

## Webhook-event comparison

### Klaviyo (current)

```ts
type KlaviyoMetricEvent = {
  data: {
    type: string // 'Opened Email' | 'Clicked Email' | 'Placed Order'
    attributes: {
      metric_id?: string
      campaign_id?: string // → maps to externalCampaignId
      properties?: Record<string, unknown>
      datetime?: string
    }
  }
}
```

### Resend (target)

```ts
type ResendWebhookEvent = {
  type: 'email.opened' | 'email.clicked' | 'email.bounced' | 'email.delivered' | 'email.complained'
  created_at: string
  data: {
    email_id: string
    broadcast_id?: string // → maps to externalCampaignId
    to: string[]
    from: string
    subject: string
    // event-specific fields...
  }
}
```

The mapping for the existing `campaignPerformance` increments:

| Resend event       | `campaignPerformance` field                       |
| ------------------ | ------------------------------------------------- |
| `email.opened`     | `openRate++`                                      |
| `email.clicked`    | `clickThroughRate++`                              |
| `email.bounced`    | (no current field — log only)                     |
| `email.delivered`  | (ignore)                                          |
| `email.complained` | (treat as unsubscribe-adjacent if you surface it) |

`conversionRate` has no source. Either drop the field, or leave it commented out as an external-event hook with a pointer to `docs/ESP-NOTES.md`.

## What stays the same

- The schema's `externalId` + `externalCampaignId` field names are already ESP-agnostic.
- `buildHtml()` in `on-promotion-approved` still produces valid HTML — Resend accepts it via `html:`. Only the unsubscribe merge tag changes.
- The `workflow.state` approval flow, history append, error handling — all unchanged.
- The two-layer segment schema (synced vs. enrichment) stays. Just `description` becomes empty since Resend Segments don't carry one.
- Cron schedule and blueprint trigger structure — unchanged.

## What gets simpler

- Preview route: no roundtrip to ESP for rendering. Just `render(<Component/>)` from `@react-email/render` and return.
- Send function: 2 API calls instead of 5.
- No template lifecycle to manage (no orphan templates to clean up after preview).

## What gets harder or impossible

- Behavioral segmentation (must be re-implemented in Sanity Functions if the user needs it)
- Conversion attribution (no event ingestion path)
- Server-side render preview (the previous `X-Preview-Status: klaviyo-rendered` accuracy badge is meaningless under Resend — drop it)
- A/B testing of subject lines / send times (Klaviyo had this; Resend does not)
