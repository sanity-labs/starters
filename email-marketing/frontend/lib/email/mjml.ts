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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderEmailHeader(block: EmailHeaderBlock): string {
  const logo = block.logoImageUrl
    ? `<mj-image src="${escapeXml(block.logoImageUrl)}" alt="${escapeXml(block.brandName ?? 'Logo')}" width="150px" padding="10px 0" />`
    : ''
  const brandName = block.brandName
    ? `<mj-text align="center" font-size="24px" font-weight="700" padding="0 0 10px">${escapeXml(block.brandName)}</mj-text>`
    : ''

  return `
    <mj-section padding="20px 0">
      <mj-column>
        ${logo}
        ${brandName}
      </mj-column>
    </mj-section>`
}

function renderProductCard(product: ProductRef): string {
  const image = product.imageUrl
    ? `<mj-image src="${escapeXml(product.imageUrl)}" alt="${escapeXml(product.title ?? '')}" width="150px" padding="0 0 8px" />`
    : ''
  const title = product.title
    ? `<mj-text font-size="14px" font-weight="600" align="center" padding="0 0 4px">${escapeXml(product.title)}</mj-text>`
    : ''
  const price =
    product.price != null
      ? `<mj-text font-size="14px" align="center" color="#666" padding="0 0 4px">$${product.price.toFixed(2)}</mj-text>`
      : ''
  const link = product.url
    ? `<mj-button href="${escapeXml(product.url)}" background-color="#1a1a1a" color="#ffffff" font-size="12px" padding="4px 0" inner-padding="8px 16px" border-radius="4px">View</mj-button>`
    : ''

  return `
      <mj-column padding="8px">
        ${image}
        ${title}
        ${price}
        ${link}
      </mj-column>`
}

function renderEmailSection(block: EmailSectionBlock): string {
  if (block.products && block.products.length > 0) {
    const headline = block.headline
      ? `<mj-section padding="10px 20px 0"><mj-column><mj-text font-size="20px" font-weight="700">${escapeXml(block.headline)}</mj-text></mj-column></mj-section>`
      : ''
    const bodyText = block.body
      ? `<mj-section padding="0 20px"><mj-column><mj-text font-size="14px" color="#444" line-height="1.5">${escapeXml(block.body)}</mj-text></mj-column></mj-section>`
      : ''

    const pairs: string[] = []
    for (let i = 0; i < block.products.length; i += 2) {
      const cols = block.products
        .slice(i, i + 2)
        .map(renderProductCard)
        .join('')
      const filler = block.products.length > i + 1 ? '' : '<mj-column></mj-column>'
      pairs.push(`<mj-section padding="10px 20px">${cols}${filler}</mj-section>`)
    }

    return `${headline}${bodyText}${pairs.join('')}`
  }

  const hasImage = !!block.imageUrl
  const textContent = [
    block.headline
      ? `<mj-text font-size="20px" font-weight="700" padding="0 0 8px">${escapeXml(block.headline)}</mj-text>`
      : '',
    block.body
      ? `<mj-text font-size="14px" color="#444" line-height="1.5" padding="0 0 8px">${escapeXml(block.body)}</mj-text>`
      : '',
  ]
    .filter(Boolean)
    .join('\n        ')

  if (hasImage) {
    return `
    <mj-section padding="20px">
      <mj-column>
        ${textContent}
      </mj-column>
      <mj-column>
        <mj-image src="${escapeXml(block.imageUrl!)}" alt="" />
      </mj-column>
    </mj-section>`
  }

  return `
    <mj-section padding="20px">
      <mj-column>
        ${textContent}
      </mj-column>
    </mj-section>`
}

function renderEmailCTA(block: EmailCTABlock): string {
  const isPrimary = block.style !== 'secondary'
  const bgColor = isPrimary ? '#1a1a1a' : '#ffffff'
  const textColor = isPrimary ? '#ffffff' : '#1a1a1a'
  const border = isPrimary ? 'none' : '1px solid #1a1a1a'

  return `
    <mj-section padding="10px 20px">
      <mj-column>
        <mj-button href="${escapeXml(block.url ?? '#')}" background-color="${bgColor}" color="${textColor}" font-size="16px" border-radius="4px" inner-padding="12px 32px" border="${border}">${escapeXml(block.text ?? 'Click Here')}</mj-button>
      </mj-column>
    </mj-section>`
}

function renderEmailDivider(): string {
  return `
    <mj-section padding="0 20px">
      <mj-column>
        <mj-divider border-color="#e0e0e0" border-width="1px" />
      </mj-column>
    </mj-section>`
}

function renderEmailFooter(block: EmailFooterBlock): string {
  const legal = block.legalText
    ? `<mj-text font-size="11px" color="#999" align="center" line-height="1.4" padding="0 0 8px">${escapeXml(block.legalText)}</mj-text>`
    : ''
  const unsub = block.unsubscribeText
    ? `<mj-text font-size="11px" color="#999" align="center"><a href="{{ unsubscribe_url }}" style="color: #999; text-decoration: underline;">${escapeXml(block.unsubscribeText)}</a></mj-text>`
    : ''

  return `
    <mj-section padding="20px" background-color="#f9f9f9">
      <mj-column>
        ${legal}
        ${unsub}
      </mj-column>
    </mj-section>`
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

export function assembleEmailMjml(email: EmailDocument): string {
  const blocks = (email.body ?? []).map(renderBlock).join('')

  return `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="system-ui, -apple-system, sans-serif" />
      <mj-text font-size="14px" color="#1a1a1a" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#ffffff">
    ${blocks}
  </mj-body>
</mjml>`
}
