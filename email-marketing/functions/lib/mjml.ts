type EmailHeaderBlock = {
  _type: 'emailHeader'
  brandName?: string
  logoImageUrl?: string
}

type ProductRef = {
  _id: string
  title?: string
  price?: number
  description?: string
  url?: string
  imageUrl?: string
}

type EmailSectionBlock = {
  _type: 'emailSection'
  headline?: string
  body?: string
  image?: {asset?: {_ref?: string}}
  products?: ProductRef[]
  imageUrl?: string
}

type EmailCTABlock = {
  _type: 'emailCTA'
  text?: string
  url?: string
  style?: 'primary' | 'secondary'
}

type EmailDividerBlock = {
  _type: 'emailDivider'
}

type EmailFooterBlock = {
  _type: 'emailFooter'
  legalText?: string
  unsubscribeText?: string
}

type EmailBlock =
  | EmailHeaderBlock
  | EmailSectionBlock
  | EmailCTABlock
  | EmailDividerBlock
  | EmailFooterBlock

export type EmailDocument = {
  _id: string
  title?: string
  subject?: string
  preheader?: string
  body?: EmailBlock[]
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderEmailHeader(block: EmailHeaderBlock): string {
  const logo = block.logoImageUrl
    ? `<tr><td align="center" style="padding: 10px 0;"><img src="${escapeHtml(block.logoImageUrl)}" alt="${escapeHtml(block.brandName ?? 'Logo')}" width="150" style="display: block; max-width: 150px; height: auto;" /></td></tr>`
    : ''
  const brandName = block.brandName
    ? `<tr><td align="center" style="font-size: 24px; font-weight: 700; padding: 0 0 10px; color: #1a1a1a;">${escapeHtml(block.brandName)}</td></tr>`
    : ''

  return `<tr><td style="padding: 20px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${logo}
    ${brandName}
  </table>
</td></tr>`
}

function renderProductCard(product: ProductRef): string {
  const image = product.imageUrl
    ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.title ?? '')}" width="150" style="display: block; max-width: 150px; height: auto; margin: 0 auto 8px;" />`
    : ''
  const title = product.title
    ? `<p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; text-align: center; color: #1a1a1a;">${escapeHtml(product.title)}</p>`
    : ''
  const price =
    product.price != null
      ? `<p style="margin: 0 0 4px; font-size: 14px; text-align: center; color: #666;">$${product.price.toFixed(2)}</p>`
      : ''
  const link = product.url
    ? `<p style="margin: 4px 0 0; text-align: center;"><a href="${escapeHtml(product.url)}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; font-size: 12px; padding: 8px 16px; border-radius: 4px; text-decoration: none;">View</a></p>`
    : ''

  return `<td width="50%" valign="top" style="padding: 8px; text-align: center;">
    ${image}
    ${title}
    ${price}
    ${link}
  </td>`
}

function renderEmailSection(block: EmailSectionBlock): string {
  if (block.products && block.products.length > 0) {
    const headline = block.headline
      ? `<tr><td style="padding: 10px 20px 0; font-size: 20px; font-weight: 700; color: #1a1a1a;">${escapeHtml(block.headline)}</td></tr>`
      : ''
    const bodyText = block.body
      ? `<tr><td style="padding: 0 20px; font-size: 14px; color: #444; line-height: 1.5;">${escapeHtml(block.body)}</td></tr>`
      : ''

    const pairs: string[] = []
    for (let i = 0; i < block.products.length; i += 2) {
      const cols = block.products
        .slice(i, i + 2)
        .map(renderProductCard)
        .join('')
      const filler = block.products.length > i + 1 ? '' : '<td width="50%"></td>'
      pairs.push(`<tr><td style="padding: 10px 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cols}${filler}</tr></table>
</td></tr>`)
    }

    return `${headline}${bodyText}${pairs.join('')}`
  }

  const hasImage = !!block.imageUrl
  const headlineHtml = block.headline
    ? `<p style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #1a1a1a;">${escapeHtml(block.headline)}</p>`
    : ''
  const bodyHtml = block.body
    ? `<p style="margin: 0 0 8px; font-size: 14px; color: #444; line-height: 1.5;">${escapeHtml(block.body)}</p>`
    : ''

  if (hasImage) {
    return `<tr><td style="padding: 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="50%" valign="top" style="padding-right: 10px;">
      ${headlineHtml}
      ${bodyHtml}
    </td>
    <td width="50%" valign="top">
      <img src="${escapeHtml(block.imageUrl!)}" alt="" style="display: block; max-width: 100%; height: auto;" />
    </td>
  </tr></table>
</td></tr>`
  }

  return `<tr><td style="padding: 20px;">
  ${headlineHtml}
  ${bodyHtml}
</td></tr>`
}

function renderEmailCTA(block: EmailCTABlock): string {
  const isPrimary = block.style !== 'secondary'
  const bgColor = isPrimary ? '#1a1a1a' : '#ffffff'
  const textColor = isPrimary ? '#ffffff' : '#1a1a1a'
  const border = isPrimary ? '' : 'border: 1px solid #1a1a1a; '

  return `<tr><td align="center" style="padding: 10px 20px;">
  <a href="${escapeHtml(block.url ?? '#')}" style="display: inline-block; background-color: ${bgColor}; color: ${textColor}; font-size: 16px; padding: 12px 32px; border-radius: 4px; text-decoration: none; ${border}font-family: system-ui, -apple-system, sans-serif;">${escapeHtml(block.text ?? 'Click Here')}</a>
</td></tr>`
}

function renderEmailDivider(): string {
  return `<tr><td style="padding: 0 20px;">
  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 0;" />
</td></tr>`
}

function renderEmailFooter(block: EmailFooterBlock): string {
  const legal = block.legalText
    ? `<p style="margin: 0 0 8px; font-size: 11px; color: #999; text-align: center; line-height: 1.4;">${escapeHtml(block.legalText)}</p>`
    : ''
  const unsub = block.unsubscribeText
    ? `<p style="margin: 0; font-size: 11px; color: #999; text-align: center;"><a href="{{ unsubscribe_url }}" style="color: #999; text-decoration: underline;">${escapeHtml(block.unsubscribeText)}</a></p>`
    : ''

  return `<tr><td style="padding: 20px; background-color: #f9f9f9;">
  ${legal}
  ${unsub}
</td></tr>`
}

function renderBlock(block: EmailBlock): string {
  switch (block._type) {
    case 'emailHeader':
      return renderEmailHeader(block)
    case 'emailSection':
      return renderEmailSection(block)
    case 'emailCTA':
      return renderEmailCTA(block)
    case 'emailDivider':
      return renderEmailDivider()
    case 'emailFooter':
      return renderEmailFooter(block)
    default:
      return ''
  }
}

export function renderEmailHtml(email: EmailDocument): string {
  const blocks = (email.body ?? []).map(renderBlock).join('\n          ')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #ffffff; font-family: system-ui, -apple-system, sans-serif; -webkit-text-size-adjust: 100%; }
    table { border-collapse: collapse; }
    img { max-width: 100%; height: auto; border: 0; }
    p { font-family: system-ui, -apple-system, sans-serif; }
    a { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; font-size: 14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff;">
    <tr>
      <td align="center">
        <table class="container" role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          ${blocks}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
