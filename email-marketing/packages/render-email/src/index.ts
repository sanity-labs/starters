/**
 * @starter/render-email
 *
 * Platform-agnostic MJML rendering, sanitization, escaping, and ESP stub handling
 * for email preview and dispatch.
 *
 * ## Usage
 *
 * Local render (content ops):
 * ```ts
 * import {renderPromotionLocal} from '@starter/render-email'
 * const html = await renderPromotionLocal(promotion, previewContext)
 * ```
 *
 * Klaviyo render, sanitized for a browser preview:
 * ```ts
 * import {renderPromotionKlaviyo} from '@starter/render-email'
 * import {sanitizeEmailHtml} from '@starter/render-email/sanitize'
 * const html = sanitizeEmailHtml(await renderPromotionKlaviyo(promotion))
 * ```
 *
 * Streaming helpers (async iterables, not Node streams):
 * ```ts
 * import {renderMjmlStream, stubReplacer, streamToString} from '@starter/render-email/streaming'
 * const html = await streamToString(stubReplacer(renderMjmlStream(mjml), {coupon_code: 'SAVE10'}))
 * ```
 *
 * Stubs & accuracy metadata:
 * ```ts
 * import {buildPreviewStatus, stubKlaviyoTags} from '@starter/render-email/stubs'
 * ```
 *
 * Escaping helpers, dependency-free so a Sanity Function can bundle them:
 * ```ts
 * import {escapeHtml, safeHttpUrl} from '@starter/render-email/escape'
 * ```
 */

export type {
  RenderContext,
  RenderAdapter,
  PreviewStatus,
  EmailBlock,
  EmailHeaderBlock,
  EmailSectionBlock,
  EmailCTABlock,
  EmailDividerBlock,
  EmailFooterBlock,
  Promotion,
  StreamOptions,
} from './types'

import mjml from 'mjml'
import {stubKlaviyoTags} from './stubs'
import {escapeHtml, safeHttpUrl} from './escape'

type Block = {
  _type?: string | null
  brandName?: string | null
  logoImageUrl?: string | null
  headline?: string | null
  body?: string | null
  imageUrl?: string | null
  products?: Array<{
    title?: string | null
    price?: number | null
    url?: string | null
    imageUrl?: string | null
  }> | null
  text?: string | null
  url?: string | null
  style?: string | null
  spacing?: string | null
  legalText?: string | null
  unsubscribeText?: string | null
}

type PromotionInput = {
  disruptor?: string | null
  emailSlots?: Block[] | null
}

function renderHeaderMjml(block: Block): string {
  const parts: string[] = []
  const logoUrl = safeHttpUrl(block.logoImageUrl)
  if (logoUrl) {
    parts.push(
      `<mj-image src="${escapeHtml(logoUrl)}" alt="${escapeHtml(block.brandName)}" width="150px" padding="16px 0" />`,
    )
  }
  if (block.brandName && !logoUrl) {
    parts.push(
      `<mj-text font-size="18px" font-weight="bold" color="#111111" align="center">${escapeHtml(block.brandName)}</mj-text>`,
    )
  }
  if (parts.length === 0) return ''
  return `<mj-section padding="16px 32px" background-color="#ffffff">
      <mj-column>${parts.join('\n        ')}</mj-column>
    </mj-section>`
}

function renderSectionMjml(block: Block): string {
  const parts: string[] = []

  const imageUrl = safeHttpUrl(block.imageUrl)
  if (imageUrl) {
    parts.push(`<mj-section padding="0">
      <mj-column>
        <mj-image src="${escapeHtml(imageUrl)}" alt="" width="600px" padding="0" />
      </mj-column>
    </mj-section>`)
  }

  const textParts: string[] = []
  if (block.headline) {
    textParts.push(
      `<mj-text font-size="22px" font-weight="bold" color="#111111" padding-bottom="8px">${escapeHtml(block.headline)}</mj-text>`,
    )
  }
  if (block.body) {
    textParts.push(
      `<mj-text font-size="15px" color="#555555" line-height="1.6" padding-bottom="16px">${escapeHtml(block.body)}</mj-text>`,
    )
  }
  if (textParts.length > 0) {
    parts.push(`<mj-section padding="24px 32px" background-color="#ffffff">
      <mj-column>${textParts.join('\n        ')}</mj-column>
    </mj-section>`)
  }

  const products = block.products ?? []
  if (products.length > 0) {
    const productCols = products
      .map((p) => {
        const col: string[] = []
        const productImageUrl = safeHttpUrl(p.imageUrl)
        const productUrl = safeHttpUrl(p.url)
        if (productImageUrl) {
          col.push(
            `<mj-image src="${escapeHtml(productImageUrl)}" alt="${escapeHtml(p.title)}" width="250px" padding-bottom="8px" />`,
          )
        }
        if (p.title) {
          col.push(
            `<mj-text font-size="14px" font-weight="bold" color="#111111">${escapeHtml(p.title)}</mj-text>`,
          )
        }
        if (p.price != null) {
          col.push(`<mj-text font-size="13px" color="#555555">$${p.price.toFixed(2)}</mj-text>`)
        }
        if (productUrl) {
          col.push(
            `<mj-button background-color="#111111" color="#ffffff" href="${escapeHtml(productUrl)}" font-size="12px" border-radius="4px" inner-padding="8px 16px">View</mj-button>`,
          )
        }
        return `<mj-column>${col.join('\n        ')}</mj-column>`
      })
      .join('\n      ')
    parts.push(`<mj-section padding="16px 32px" background-color="#ffffff">
      ${productCols}
    </mj-section>`)
  }

  return parts.join('\n    ')
}

function renderCTAMjml(block: Block): string {
  const url = safeHttpUrl(block.url)
  if (!block.text || !url) return ''
  const bg = block.style === 'secondary' ? '#ffffff' : '#111111'
  const fg = block.style === 'secondary' ? '#111111' : '#ffffff'
  const border = block.style === 'secondary' ? 'border="1px solid #111111"' : ''
  return `<mj-section padding="16px 32px" background-color="#ffffff">
      <mj-column>
        <mj-button background-color="${bg}" color="${fg}" ${border} href="${escapeHtml(url)}" font-size="14px" border-radius="4px" inner-padding="12px 24px">${escapeHtml(block.text)}</mj-button>
      </mj-column>
    </mj-section>`
}

function renderDividerMjml(block: Block): string {
  const padding =
    block.spacing === 'small' ? '8px 0' : block.spacing === 'large' ? '32px 0' : '16px 0'
  return `<mj-divider border-color="#eeeeee" padding="${padding}" />`
}

function renderFooterMjml(block: Block): string {
  const parts: string[] = []
  if (block.legalText) {
    parts.push(
      `<mj-text font-size="11px" color="#aaaaaa" align="center" padding-bottom="8px">${escapeHtml(block.legalText)}</mj-text>`,
    )
  }
  const unsubText = block.unsubscribeText ?? 'Unsubscribe'
  parts.push(`<mj-text font-size="11px" color="#aaaaaa" align="center">
          <a href="{{ unsubscribe_url }}" style="color:#aaaaaa;text-decoration:none;">${escapeHtml(unsubText)}</a>
        </mj-text>`)
  return `<mj-section background-color="#ffffff" padding="24px">
      <mj-column>${parts.join('\n        ')}</mj-column>
    </mj-section>`
}

function renderBlock(block: Block): string {
  switch (block._type) {
    case 'emailHeader':
      return renderHeaderMjml(block)
    case 'emailSection':
      return renderSectionMjml(block)
    case 'emailCTA':
      return renderCTAMjml(block)
    case 'emailDivider':
      return renderDividerMjml(block)
    case 'emailFooter':
      return renderFooterMjml(block)
    default:
      return ''
  }
}

function buildMjml(promotion: PromotionInput): string {
  const blocks = promotion.emailSlots ?? []
  const sections = blocks.map(renderBlock).filter(Boolean).join('\n    ')
  const hasFooter = blocks.some((b) => b._type === 'emailFooter')

  return `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Arial, Helvetica, sans-serif" />
      <mj-body background-color="#f5f5f5" />
      <mj-section background-color="#ffffff" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f5f5f5">
    ${
      promotion.disruptor
        ? `<mj-section background-color="#111111" padding="8px 0">
      <mj-column>
        <mj-text color="#ffffff" font-size="11px" font-weight="bold" letter-spacing="3px" align="center">${escapeHtml(promotion.disruptor)}</mj-text>
      </mj-column>
    </mj-section>`
        : ''
    }
    ${sections}
    ${
      !hasFooter
        ? `<mj-section background-color="#ffffff" padding="24px">
      <mj-column>
        <mj-text font-size="11px" color="#aaaaaa" align="center">
          <a href="{{ unsubscribe_url }}" style="color:#aaaaaa;text-decoration:none;">Unsubscribe</a>
        </mj-text>
      </mj-column>
    </mj-section>`
        : ''
    }
  </mj-body>
</mjml>`
}

function resolveTokens(html: string, tokens: Record<string, string>): string {
  let out = html
  for (const [key, value] of Object.entries(tokens)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value)
  }
  return out
}

/**
 * Render a promotion to HTML for local preview.
 * Resolves personalization tokens from previewContext sample data.
 * Remaining Klaviyo tags are replaced with safe fallback values.
 */
export async function renderPromotionLocal(
  promotion: PromotionInput,
  previewContext?: Record<string, string>,
): Promise<string> {
  let mjmlContent = buildMjml(promotion)

  if (previewContext && Object.keys(previewContext).length > 0) {
    mjmlContent = resolveTokens(mjmlContent, previewContext)
  }

  const {html} = await mjml(mjmlContent)
  const {html: stubbed} = stubKlaviyoTags(html)
  return stubbed
}

/**
 * Render a promotion to HTML for Klaviyo dispatch.
 * Klaviyo Handlebars tokens ({{ unsubscribe_url }}, {{ profile.first_name }}, etc.)
 * are preserved as-is — Klaviyo resolves them at send time.
 */
export async function renderPromotionKlaviyo(
  promotion: PromotionInput,
  _adapter?: unknown,
): Promise<string> {
  const {html} = await mjml(buildMjml(promotion))
  return html
}
