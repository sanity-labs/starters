import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import {defineQuery} from 'groq'
import {ApiKeySession, CampaignsApi, TemplatesApi} from 'klaviyo-api'

const PROMOTION_QUERY = defineQuery(`
  *[_id == $id][0]{
    _id,
    subjectLine,
    preheader,
    disruptor,
    emailSlots[]{
      position,
      headline,
      subheadline,
      asset,
      cta,
    },
    "campaignTitle": campaign->.title,
    "segmentExternalId": segment->.externalId,
    "segmentName": segment->.name,
  }
`)

function buildHtml(promotion: {
  subjectLine?: string | null
  preheader?: string | null
  disruptor?: string | null
  emailSlots?: Array<{
    position?: string | null
    headline?: string | null
    subheadline?: string | null
    asset?: {url?: string | null; altText?: string | null} | null
    cta?: {text?: string | null; url?: string | null} | null
  }> | null
}): string {
  const slots = promotion.emailSlots ?? []
  const slotHtml = slots
    .map(
      (slot) => `
    <div style="padding:24px;border-bottom:1px solid #eee;">
      ${slot.asset?.url ? `<img src="${slot.asset.url}" alt="${slot.asset.altText ?? ''}" style="width:100%;max-width:600px;display:block;" />` : ''}
      ${slot.headline ? `<h2 style="margin:16px 0 8px;font-size:22px;">${slot.headline}</h2>` : ''}
      ${slot.subheadline ? `<p style="margin:0 0 16px;color:#555;font-size:15px;">${slot.subheadline}</p>` : ''}
      ${slot.cta?.text && slot.cta.url ? `<a href="${slot.cta.url}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:4px;font-size:14px;">${slot.cta.text}</a>` : ''}
    </div>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${promotion.subjectLine ?? ''}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">
    ${promotion.disruptor ? `<div style="background:#111;color:#fff;text-align:center;padding:8px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">${promotion.disruptor}</div>` : ''}
    ${slotHtml}
    <div style="padding:24px;text-align:center;font-size:11px;color:#aaa;">
      <a href="{{ unsubscribe_url }}" style="color:#aaa;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`
}

export const handler = documentEventHandler(async ({context, event}) => {
  const client = createClient({...context.clientOptions, apiVersion: '2026-04-08', useCdn: false})
  const wfId = event.data._id
  const promotionRef = (event.data as {promotionId?: {_ref?: string}}).promotionId?._ref

  if (!promotionRef) {
    console.error('[on-promotion-approved] workflow.state has no promotionId ref')
    return
  }

  const apiKey = process.env.KLAVIYO_API_KEY
  if (!apiKey) {
    console.error('[on-promotion-approved] KLAVIYO_API_KEY not set')
    return
  }

  try {
    const promotion = await client.fetch(PROMOTION_QUERY, {id: promotionRef})
    if (!promotion) throw new Error(`Promotion ${promotionRef} not found`)

    const session = new ApiKeySession(apiKey)
    const templatesApi = new TemplatesApi(session)
    const campaignsApi = new CampaignsApi(session)

    const label = `${promotion.campaignTitle ?? 'Campaign'} — ${promotion.segmentName ?? 'Base'} — ${Date.now()}`
    const html = buildHtml(promotion)

    // Create template
    const templateResult = await templatesApi.createTemplate({
      data: {
        type: 'template',
        attributes: {name: label, editorType: 'CODE', html},
      },
    })
    const templateId = templateResult.body.data?.id
    if (!templateId) throw new Error('Failed to create Klaviyo template')

    // Create campaign with inline message definition
    const campaignResult = await campaignsApi.createCampaign({
      data: {
        type: 'campaign',
        attributes: {
          name: label,
          audiences: {
            included: promotion.segmentExternalId ? [promotion.segmentExternalId] : [],
            excluded: [],
          },
          campaignMessages: {
            data: [
              {
                type: 'campaign-message',
                attributes: {
                  definition: {
                    channel: 'email',
                    label,
                    content: {
                      subject: promotion.subjectLine ?? '',
                      previewText: promotion.preheader ?? '',
                      fromEmail: 'hello@example.com',
                      fromLabel: promotion.campaignTitle ?? '',
                      replyToEmail: 'hello@example.com',
                    },
                  },
                },
              },
            ],
          },
        },
      },
    })
    const klaviyoCampaignId = campaignResult.body.data?.id
    if (!klaviyoCampaignId) throw new Error('Failed to create Klaviyo campaign')

    // Get campaign message ID
    const messagesResult = await campaignsApi.getMessageIdsForCampaign(klaviyoCampaignId)
    const messageId = messagesResult.body.data?.[0]?.id
    if (!messageId) throw new Error('Failed to get campaign message ID')

    // Assign template to campaign message
    await campaignsApi.assignTemplateToCampaignMessage({
      data: {
        type: 'campaign-message',
        id: messageId,
        relationships: {
          template: {
            data: {type: 'template', id: templateId},
          },
        },
      },
    })

    // Send
    await campaignsApi.createCampaignSendJob({
      data: {type: 'campaign-send-job', id: klaviyoCampaignId},
    })

    await client
      .patch(wfId)
      .set({status: 'sent', sentAt: new Date().toISOString()})
      .append('history', [
        {
          _key: `h-${Date.now()}`,
          _type: 'object',
          status: 'sent',
          timestamp: new Date().toISOString(),
        },
      ])
      .commit()

    console.log(
      `[on-promotion-approved] Sent ${promotionRef} via Klaviyo campaign ${klaviyoCampaignId}`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[on-promotion-approved] Failed: ${message}`)
    await client
      .patch(wfId)
      .append('history', [
        {
          _key: `h-${Date.now()}`,
          _type: 'object',
          status: 'approved',
          timestamp: new Date().toISOString(),
        },
      ])
      .commit()
  }
})
