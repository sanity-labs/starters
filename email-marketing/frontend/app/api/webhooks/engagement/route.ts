import {createClient} from 'next-sanity'
import {defineQuery} from 'next-sanity'
import {Resend} from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET ?? 'production',
  apiVersion: '2026-04-08',
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
})

const PROMOTION_BY_BROADCAST_QUERY = defineQuery(`
  *[_type == "promotion" && externalCampaignId == $id][0]._id
`)

const CURRENT_PERFORMANCE_QUERY = defineQuery(`
  *[_type == "promotion" && _id == $id][0].campaignPerformance
`)

type ResendWebhookEvent = {
  type: string
  created_at?: string
  data: {
    email_id?: string
    broadcast_id?: string
    to?: string[]
    from?: string
    subject?: string
  }
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) {
    return new Response('Webhook secret not configured', {status: 500})
  }

  try {
    resend.webhooks.verify({
      payload: rawBody,
      headers: {
        'svix-id': request.headers.get('svix-id') ?? '',
        'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
        'svix-signature': request.headers.get('svix-signature') ?? '',
      },
      webhookSecret,
    })
  } catch {
    return new Response('Unauthorized', {status: 401})
  }

  const event = JSON.parse(rawBody) as ResendWebhookEvent

  const broadcastId = event.data?.broadcast_id
  if (!broadcastId) return new Response(null, {status: 200})

  const promotionId = await client.fetch(PROMOTION_BY_BROADCAST_QUERY, {id: broadcastId})
  if (!promotionId) return new Response(null, {status: 200})

  const current = await client.fetch(CURRENT_PERFORMANCE_QUERY, {id: promotionId})
  const performance = current ?? {openRate: 0, clickThroughRate: 0}

  if (event.type === 'email.opened') {
    performance.openRate = (performance.openRate ?? 0) + 1
  } else if (event.type === 'email.clicked') {
    performance.clickThroughRate = (performance.clickThroughRate ?? 0) + 1
  }
  // No `conversionRate` mapping: Resend has no purchase/order events.
  // See docs/ESP-NOTES.md for guidance on wiring conversion attribution
  // from an external event source if needed.

  await client.patch(promotionId).set({campaignPerformance: performance}).commit()
  return new Response(null, {status: 200})
}
