import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import {defineQuery} from 'groq'
import {Resend} from 'resend'

const PROMOTION_QUERY = defineQuery(`
  *[_id == $id][0]{
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
    "campaignTitle": campaign->.title,
    "segmentName": segment->.name,
  }
`)

type EmailBlock = {
  _type?: string | null
  brandName?: string | null
  logoImageUrl?: string | null
  headline?: string | null
  body?: string | null
  imageUrl?: string | null
  products?: Array<{title?: string; price?: number; url?: string; imageUrl?: string}> | null
  text?: string | null
  url?: string | null
  style?: string | null
  spacing?: string | null
  legalText?: string | null
  unsubscribeText?: string | null
}

function renderBlockHtml(block: EmailBlock): string {
  switch (block._type) {
    case 'emailHeader': {
      if (block.logoImageUrl) {
        return `<div style="padding:16px 24px;text-align:center;"><img src="${block.logoImageUrl}" alt="${block.brandName ?? ''}" style="max-height:48px;" /></div>`
      }
      if (block.brandName) {
        return `<div style="padding:16px 24px;text-align:center;font-size:18px;font-weight:bold;">${block.brandName}</div>`
      }
      return ''
    }
    case 'emailSection': {
      const parts: string[] = []
      if (block.imageUrl) {
        parts.push(
          `<img src="${block.imageUrl}" alt="" style="width:100%;max-width:600px;display:block;" />`,
        )
      }
      if (block.headline) {
        parts.push(`<h2 style="margin:16px 0 8px;font-size:22px;">${block.headline}</h2>`)
      }
      if (block.body) {
        parts.push(`<p style="margin:0 0 16px;color:#555;font-size:15px;">${block.body}</p>`)
      }
      const products = block.products ?? []
      if (products.length > 0) {
        const cells = products
          .map(
            (p) =>
              `<td style="padding:8px;vertical-align:top;width:50%;text-align:center;">${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.title ?? ''}" style="width:100%;max-width:250px;" />` : ''}${p.title ? `<p style="font-size:14px;font-weight:bold;margin:8px 0 4px;">${p.title}</p>` : ''}${p.price != null ? `<p style="font-size:13px;color:#555;margin:0;">$${p.price.toFixed(2)}</p>` : ''}${p.url ? `<a href="${p.url}" style="display:inline-block;margin-top:8px;padding:8px 16px;background:#111;color:#fff;text-decoration:none;border-radius:4px;font-size:12px;">View</a>` : ''}</td>`,
          )
          .join('')
        parts.push(`<table style="width:100%;border-collapse:collapse;"><tr>${cells}</tr></table>`)
      }
      if (parts.length === 0) return ''
      return `<div style="padding:24px;border-bottom:1px solid #eee;">${parts.join('')}</div>`
    }
    case 'emailCTA': {
      if (!block.text || !block.url) return ''
      const bg = block.style === 'secondary' ? '#fff' : '#111'
      const fg = block.style === 'secondary' ? '#111' : '#fff'
      const border = block.style === 'secondary' ? 'border:1px solid #111;' : ''
      return `<div style="padding:16px 24px;text-align:center;"><a href="${block.url}" style="display:inline-block;padding:12px 24px;background:${bg};color:${fg};${border}text-decoration:none;border-radius:4px;font-size:14px;">${block.text}</a></div>`
    }
    case 'emailDivider': {
      const py = block.spacing === 'small' ? '8px' : block.spacing === 'large' ? '32px' : '16px'
      return `<hr style="border:none;border-top:1px solid #eee;margin:${py} 0;" />`
    }
    case 'emailFooter': {
      const unsubText = block.unsubscribeText ?? 'Unsubscribe'
      return `<div style="padding:24px;text-align:center;font-size:11px;color:#aaa;">${block.legalText ? `<p style="margin:0 0 8px;">${block.legalText}</p>` : ''}<a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#aaa;">${unsubText}</a></div>`
    }
    default:
      return ''
  }
}

function buildHtml(promotion: {
  subjectLine?: string | null
  preheader?: string | null
  disruptor?: string | null
  emailSlots?: EmailBlock[] | null
}): string {
  const blocks = promotion.emailSlots ?? []
  const blockHtml = blocks.map(renderBlockHtml).filter(Boolean).join('')
  const hasFooter = blocks.some((b) => b._type === 'emailFooter')

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
    ${blockHtml}
    ${!hasFooter ? `<div style="padding:24px;text-align:center;font-size:11px;color:#aaa;"><a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#aaa;">Unsubscribe</a></div>` : ''}
  </div>
</body>
</html>`
}

export const handler = documentEventHandler(async ({context, event}) => {
  const client = createClient({...context.clientOptions, apiVersion: '2026-04-08', useCdn: false})
  const promotionId = event.data._id

  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const testTo = process.env.RESEND_TEST_TO || 'delivered@resend.dev'

  if (!apiKey || !fromEmail) {
    const msg = 'RESEND_API_KEY or RESEND_FROM_EMAIL not set on function runtime env'
    console.error(`[on-promotion-test-send] ${msg}`)
    await client
      .patch(promotionId)
      .set({'testSend.status': 'error', 'testSend.errorMessage': msg})
      .commit()
    return
  }

  await client.patch(promotionId).set({'testSend.status': 'sending'}).commit()

  try {
    const promotion = await client.fetch(PROMOTION_QUERY, {id: promotionId})
    if (!promotion) throw new Error(`Promotion ${promotionId} not found`)

    const resend = new Resend(apiKey)
    const html = buildHtml(promotion)
    const subject = `[TEST] ${promotion.subjectLine ?? '(no subject)'}`

    const {data, error} = await resend.emails.send({
      from: fromEmail,
      to: [testTo],
      subject,
      html,
    })
    if (error) throw new Error(`Resend emails.send failed: ${error.message}`)
    if (!data?.id) throw new Error('Resend returned no email id')

    await client
      .patch(promotionId)
      .set({
        'testSend.status': 'sent',
        'testSend.sentAt': new Date().toISOString(),
        'testSend.sentTo': testTo,
        'testSend.errorMessage': null,
      })
      .commit()

    console.log(
      `[on-promotion-test-send] Sent test for ${promotionId} to ${testTo} (resend id ${data.id})`,
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[on-promotion-test-send] Failed: ${message}`)
    await client
      .patch(promotionId)
      .set({'testSend.status': 'error', 'testSend.errorMessage': message.slice(0, 500)})
      .commit()
  }
})
