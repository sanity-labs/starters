import {createClient, defineQuery} from 'next-sanity'
import {ApiKeySession, TemplatesApi} from 'klaviyo-api'
import {verifyPreviewSecret, PREVIEW_SECURITY_HEADERS} from '../../_auth'
import 'sanity-types'

async function createKlaviyoTemplate(apiKey: string, name: string, html: string): Promise<string> {
  const api = new TemplatesApi(new ApiKeySession(apiKey))
  const result = await api.createTemplate({
    data: {type: 'template', attributes: {name, editorType: 'CODE', html}},
  })
  const id = result.body.data?.id
  if (!id) throw new Error('Klaviyo template creation returned no ID')
  return id
}

async function renderKlaviyoTemplate(
  apiKey: string,
  templateId: string,
  context: Record<string, string>,
): Promise<string> {
  const api = new TemplatesApi(new ApiKeySession(apiKey))
  const result = await api.createTemplateRender({
    data: {type: 'template', id: templateId, attributes: {context}},
  })
  const html = result.body.data?.attributes?.html
  if (!html) throw new Error('Klaviyo template render returned no HTML')
  return html
}

async function deleteKlaviyoTemplate(apiKey: string, templateId: string): Promise<void> {
  const api = new TemplatesApi(new ApiKeySession(apiKey))
  await api.deleteTemplate(templateId)
}

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

function buildPreviewStatus(
  originalHtml: string,
  renderedHtml: string,
  contextKeys: string[],
): {header: string; body: object} {
  const resolved: Record<string, 'sample' | 'dynamic'> = {}
  const stubbed: Record<string, 'send-time-only'> = {}

  for (const key of contextKeys) {
    const wasPresent = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`).test(originalHtml)
    if (wasPresent) {
      const stillPresent = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`).test(renderedHtml)
      if (!stillPresent) {
        resolved[key] = 'sample'
      } else {
        stubbed[key] = 'send-time-only'
      }
    }
  }

  for (const match of renderedHtml.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
    const key = match[1]
    if (!contextKeys.includes(key)) {
      stubbed[key] = 'send-time-only'
    }
  }

  const totalTracked = Object.keys(resolved).length + Object.keys(stubbed).length
  const resolvedCount = Object.keys(resolved).length
  const ratio = totalTracked === 0 ? 1 : resolvedCount / totalTracked
  const accuracy: 'high' | 'medium' | 'low' =
    ratio >= 0.8 ? 'high' : ratio >= 0.5 ? 'medium' : 'low'

  const body = {resolved, stubbed, accuracy, timestamp: new Date().toISOString()}
  return {header: JSON.stringify(body), body}
}

export async function GET(
  request: Request,
  {params}: {params: Promise<{id: string}>},
): Promise<Response> {
  if (!verifyPreviewSecret(request)) {
    return new Response('Unauthorized', {status: 401})
  }

  const {id: rawId} = await params
  const id = rawId.replace(/^drafts\./, '')
  const apiKey = process.env.KLAVIYO_API_KEY
  const wantsJson = request.headers.get('accept')?.includes('application/json')

  const promotion = await client.fetch(PROMOTION_RENDER_QUERY, {id})
  if (!promotion) return new Response('Not Found', {status: 404})

  const {renderPromotionKlaviyo} = await import('@starter/render-email')
  const klaviyoHtml = await renderPromotionKlaviyo(promotion)
  const contextKeys = (promotion.previewContext ?? []).map((t) => t.key ?? '').filter(Boolean)

  let renderedHtml = klaviyoHtml
  let templateId: string | null = null

  if (apiKey) {
    try {
      const label = `preview-${id}-${Date.now()}`
      templateId = await createKlaviyoTemplate(apiKey, label, klaviyoHtml)

      const context: Record<string, string> = {}
      for (const token of promotion.previewContext ?? []) {
        if (token.key && token.sample) context[token.key] = token.sample
      }

      renderedHtml = await renderKlaviyoTemplate(apiKey, templateId, context)
    } finally {
      if (templateId && apiKey) {
        await deleteKlaviyoTemplate(apiKey, templateId).catch(() => {})
      }
    }
  }

  const {header, body} = buildPreviewStatus(klaviyoHtml, renderedHtml, contextKeys)

  if (wantsJson) {
    return new Response(JSON.stringify({html: renderedHtml, previewStatus: body}), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Preview-Status': header,
      },
    })
  }

  return new Response(renderedHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Preview-Status': header,
      ...PREVIEW_SECURITY_HEADERS,
    },
  })
}
