import {createClient} from 'next-sanity'
import {defineQuery} from 'next-sanity'
import {createHmac, timingSafeEqual} from 'node:crypto'

function verifyKlaviyoSignature(req: Request, rawBody: string): boolean {
  const signingKey = process.env.KLAVIYO_WEBHOOK_SECRET
  if (!signingKey) return true

  const timestamp = req.headers.get('X-Klaviyo-Request-Timestamp')
  const signature = req.headers.get('X-Klaviyo-Request-Signature')
  if (!timestamp || !signature) return false

  const age = Date.now() / 1000 - Number(timestamp)
  if (Number.isNaN(age) || age > 300 || age < 0) return false

  const expected = createHmac('sha256', signingKey)
    .update(timestamp + rawBody)
    .digest('base64')

  const sigBuf = Buffer.from(signature, 'base64')
  const expBuf = Buffer.from(expected, 'base64')
  return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)
}

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET ?? 'production',
  apiVersion: '2026-04-08',
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
  requestTagPrefix: 'frontend.email-marketing',
})

const PROMOTION_BY_KLAVIYO_CAMPAIGN_QUERY = defineQuery(`
  *[_type == "promotion" && externalCampaignId == $id][0]._id
`)

const CURRENT_PERFORMANCE_QUERY = defineQuery(`
  *[_type == "promotion" && _id == $id][0].campaignPerformance
`)

type KlaviyoMetricEvent = {
  data: {
    type: string
    attributes: {
      metric_id?: string
      campaign_id?: string
      properties?: Record<string, unknown>
      datetime?: string
    }
  }
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()
  if (!verifyKlaviyoSignature(request, rawBody)) {
    return new Response('Unauthorized', {status: 401})
  }

  const body = JSON.parse(rawBody) as KlaviyoMetricEvent[]

  for (const event of body) {
    const campaignId = event.data?.attributes?.campaign_id
    if (!campaignId) continue

    const promotionId = await client.fetch(
      PROMOTION_BY_KLAVIYO_CAMPAIGN_QUERY,
      {id: campaignId},
      {tag: 'webhook.engagement.fetch'},
    )
    if (!promotionId) continue

    const current = await client.fetch(
      CURRENT_PERFORMANCE_QUERY,
      {id: promotionId},
      {tag: 'webhook.engagement.fetch'},
    )
    const performance = current ?? {openRate: 0, clickThroughRate: 0, conversionRate: 0}

    const metricType = event.data?.type
    if (metricType === 'Opened Email') {
      performance.openRate = (performance.openRate ?? 0) + 1
    } else if (metricType === 'Clicked Email') {
      performance.clickThroughRate = (performance.clickThroughRate ?? 0) + 1
    } else if (metricType === 'Placed Order') {
      performance.conversionRate = (performance.conversionRate ?? 0) + 1
    }

    await client
      .patch(promotionId)
      .set({campaignPerformance: performance})
      .commit({tag: 'webhook.engagement.write'})
  }

  return new Response(null, {status: 200})
}
