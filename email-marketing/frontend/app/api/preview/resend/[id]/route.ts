import {createClient, defineQuery} from 'next-sanity'
import {verifyPreviewSecret, PREVIEW_SECURITY_HEADERS} from '../../_auth'
import 'sanity-types'

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2026-04-08',
  token: process.env.SANITY_API_READ_TOKEN,
  useCdn: false,
  perspective: 'previewDrafts',
})

const PROMOTION_RENDER_QUERY = defineQuery(`
  *[_type == "promotion" && _id == $id][0]{
    _id,
    subjectLine,
    preheader,
    disruptor,
    emailSlots[]{
      ...,
      _type == "emailSection" => {
        "imageUrl": image.asset->url,
        products[]->{ _id, title, price, url, "imageUrl": image.asset->url },
      },
      _type == "emailHeader" => {
        "logoImageUrl": logoUrl.asset->url,
      },
    },
    "previewContext": campaign->.previewContext.tokens[]{key, sample, description},
  }
`)

export async function GET(
  request: Request,
  {params}: {params: Promise<{id: string}>},
): Promise<Response> {
  if (!verifyPreviewSecret(request)) {
    return new Response('Unauthorized', {status: 401})
  }

  const {id: rawId} = await params
  const id = rawId.replace(/^drafts\./, '')
  const wantsJson = request.headers.get('accept')?.includes('application/json')

  const promotion = await client.fetch(PROMOTION_RENDER_QUERY, {id})
  if (!promotion) return new Response('Not Found', {status: 404})

  const {renderPromotionLocal} = await import('@starter/render-email')

  const previewContext: Record<string, string> = {}
  for (const token of promotion.previewContext ?? []) {
    if (token.key && token.sample) previewContext[token.key] = token.sample
  }

  const html = await renderPromotionLocal(promotion, previewContext)

  const previewStatus = {
    mode: 'local-render',
    timestamp: new Date().toISOString(),
  }
  const statusHeader = JSON.stringify(previewStatus)

  if (wantsJson) {
    return new Response(JSON.stringify({html, previewStatus}), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Preview-Status': statusHeader,
      },
    })
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Preview-Status': statusHeader,
      ...PREVIEW_SECURITY_HEADERS,
    },
  })
}
