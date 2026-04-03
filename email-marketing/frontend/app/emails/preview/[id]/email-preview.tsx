type ProductRef = {
  _id: string
  title?: string
  price?: number
  description?: string
  url?: string
  imageUrl?: string
}

type EmailBlock =
  | {_type: 'emailHeader'; _key: string; brandName?: string; logoImageUrl?: string}
  | {
      _type: 'emailSection'
      _key: string
      headline?: string
      body?: string
      imageUrl?: string
      products?: ProductRef[]
    }
  | {_type: 'emailCTA'; _key: string; text?: string; url?: string; style?: 'primary' | 'secondary'}
  | {_type: 'emailDivider'; _key: string}
  | {_type: 'emailFooter'; _key: string; legalText?: string; unsubscribeText?: string}

function EmailHeader({block}: {block: Extract<EmailBlock, {_type: 'emailHeader'}>}) {
  return (
    <div className="py-5 text-center">
      {block.logoImageUrl && (
        <img
          src={block.logoImageUrl}
          alt={block.brandName ?? 'Logo'}
          className="mx-auto mb-2 h-auto w-[150px]"
        />
      )}
      {block.brandName && <p className="text-2xl font-bold">{block.brandName}</p>}
    </div>
  )
}

function ProductCard({product}: {product: ProductRef}) {
  return (
    <div className="flex-1 p-2 text-center">
      {product.imageUrl && (
        <img
          src={product.imageUrl}
          alt={product.title ?? ''}
          className="mx-auto mb-2 h-auto w-[150px]"
        />
      )}
      {product.title && <p className="text-sm font-semibold">{product.title}</p>}
      {product.price != null && (
        <p className="text-sm text-gray-500">${product.price.toFixed(2)}</p>
      )}
      {product.url && (
        <a
          href={product.url}
          className="mt-1 inline-block rounded bg-[#1a1a1a] px-4 py-2 text-xs text-white"
        >
          View
        </a>
      )}
    </div>
  )
}

function EmailSection({block}: {block: Extract<EmailBlock, {_type: 'emailSection'}>}) {
  if (block.products && block.products.length > 0) {
    return (
      <div className="px-5 py-3">
        {block.headline && <p className="mb-2 text-xl font-bold">{block.headline}</p>}
        {block.body && <p className="mb-3 leading-relaxed text-gray-600">{block.body}</p>}
        <div className="grid grid-cols-2 gap-2">
          {block.products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex gap-5 px-5 py-5 ${block.imageUrl ? 'items-start' : ''}`}>
      <div className="flex-1">
        {block.headline && <p className="mb-2 text-xl font-bold">{block.headline}</p>}
        {block.body && <p className="leading-relaxed text-gray-600">{block.body}</p>}
      </div>
      {block.imageUrl && (
        <div className="flex-1">
          <img src={block.imageUrl} alt="" className="h-auto w-full" />
        </div>
      )}
    </div>
  )
}

function EmailCTA({block}: {block: Extract<EmailBlock, {_type: 'emailCTA'}>}) {
  const isPrimary = block.style !== 'secondary'
  return (
    <div className="px-5 py-3 text-center">
      <a
        href={block.url ?? '#'}
        className={`inline-block rounded px-8 py-3 text-base ${
          isPrimary ? 'bg-[#1a1a1a] text-white' : 'border border-[#1a1a1a] bg-white text-[#1a1a1a]'
        }`}
      >
        {block.text ?? 'Click Here'}
      </a>
    </div>
  )
}

function EmailDivider() {
  return (
    <div className="px-5">
      <hr className="border-gray-200" />
    </div>
  )
}

function EmailFooter({block}: {block: Extract<EmailBlock, {_type: 'emailFooter'}>}) {
  return (
    <div className="bg-gray-50 px-5 py-5 text-center">
      {block.legalText && (
        <p className="mb-2 text-xs leading-snug text-gray-400">{block.legalText}</p>
      )}
      {block.unsubscribeText && (
        <p className="text-xs text-gray-400 underline">{block.unsubscribeText}</p>
      )}
    </div>
  )
}

function renderBlock(block: EmailBlock) {
  switch (block._type) {
    case 'emailHeader':
      return <EmailHeader key={block._key} block={block} />
    case 'emailSection':
      return <EmailSection key={block._key} block={block} />
    case 'emailCTA':
      return <EmailCTA key={block._key} block={block} />
    case 'emailDivider':
      return <EmailDivider key={block._key} />
    case 'emailFooter':
      return <EmailFooter key={block._key} block={block} />
    default:
      return null
  }
}

export function EmailPreview({body}: {body?: EmailBlock[]}) {
  if (!body || body.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        No email body yet. Use the Creative Brief to generate content.
      </div>
    )
  }

  return (
    <div className="font-sans text-sm text-[#1a1a1a]">
      {body.map((block) => renderBlock(block))}
    </div>
  )
}
