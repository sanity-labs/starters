/**
 * @starter/render-email
 *
 * Platform-agnostic MJML rendering, streaming, sanitization, and ESP stub handling
 * for email preview pipelines.
 *
 * ## Usage
 *
 * Local render (content ops):
 * ```ts
 * import { renderPromotionLocal } from '@starter/render-email'
 * const html = await renderPromotionLocal(promotion, previewContext)
 * ```
 *
 * Streaming render (preview service):
 * ```ts
 * import { renderMjmlStream, sanitizeStream, StubReplacerStream } from '@starter/render-email/streaming'
 * const stream = renderMjmlStream(mjml)
 *   .pipe(sanitizeStream())
 *   .pipe(new StubReplacerStream())
 * ```
 *
 * Stubs & accuracy metadata:
 * ```ts
 * import { buildPreviewStatus, stubKlaviyoTags } from '@starter/render-email/stubs'
 * ```
 *
 * Sanitization:
 * ```ts
 * import { createEmailSanitizer } from '@starter/render-email/sanitize'
 * ```
 */

export type {
  RenderContext,
  RenderAdapter,
  PreviewStatus,
  EmailSlot,
  Promotion,
  StreamOptions,
} from './types'

import mjml from 'mjml'
import {stubKlaviyoTags} from './stubs'

type Slot = {
  position?: string | null
  asset?: {url?: string | null; altText?: string | null} | null
  assetUrl?: string | null
  headline?: string | null
  subheadline?: string | null
  cta?: {text?: string | null; url?: string | null} | null
}

type PromotionInput = {
  disruptor?: string | null
  emailSlots?: Slot[] | null
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildMjml(promotion: PromotionInput): string {
  const slots = promotion.emailSlots ?? []

  const sections = slots
    .map((slot) => {
      const imgUrl = slot.asset?.url ?? slot.assetUrl ?? null
      const parts: string[] = []

      if (imgUrl) {
        parts.push(`
    <mj-section padding="0">
      <mj-column>
        <mj-image src="${esc(imgUrl)}" alt="${esc(slot.asset?.altText ?? '')}" width="600px" padding="0" />
      </mj-column>
    </mj-section>`)
      }

      if (slot.headline || slot.subheadline || slot.cta?.text) {
        parts.push(`
    <mj-section padding="24px 32px" background-color="#ffffff">
      <mj-column>
        ${slot.headline ? `<mj-text font-size="22px" font-weight="bold" color="#111111" padding-bottom="8px">${esc(slot.headline)}</mj-text>` : ''}
        ${slot.subheadline ? `<mj-text font-size="15px" color="#555555" line-height="1.6" padding-bottom="16px">${esc(slot.subheadline)}</mj-text>` : ''}
        ${slot.cta?.text && slot.cta?.url ? `<mj-button background-color="#111111" color="#ffffff" href="${esc(slot.cta.url)}" font-size="14px" border-radius="4px" inner-padding="12px 24px">${esc(slot.cta.text)}</mj-button>` : ''}
      </mj-column>
    </mj-section>`)
      }

      return parts.join('\n    <mj-divider border-color="#eeeeee" padding="0" />')
    })
    .join('\n    <mj-divider border-color="#eeeeee" padding="0" />')

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
        <mj-text color="#ffffff" font-size="11px" font-weight="bold" letter-spacing="3px" align="center">${esc(promotion.disruptor)}</mj-text>
      </mj-column>
    </mj-section>`
        : ''
    }
    ${sections}
    <mj-section background-color="#ffffff" padding="24px">
      <mj-column>
        <mj-text font-size="11px" color="#aaaaaa" align="center">
          <a href="{{ unsubscribe_url }}" style="color:#aaaaaa;text-decoration:none;">Unsubscribe</a>
        </mj-text>
      </mj-column>
    </mj-section>
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
