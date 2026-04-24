import Link from 'next/link'
import {notFound} from 'next/navigation'
import {sanityFetch} from '@/sanity/live'
import {promotionByIdQuery} from '@/sanity/queries'

function resolveTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => tokens[key] ?? match)
}

const workflowColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  'in-review': 'bg-yellow-50 text-yellow-700',
  approved: 'bg-green-50 text-green-700',
  sent: 'bg-blue-50 text-blue-700',
  rejected: 'bg-red-50 text-red-600',
}

export default async function PromotionPreviewPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  const {data: promotion} = await sanityFetch({
    query: promotionByIdQuery,
    params: {id},
  })

  if (!promotion) notFound()

  const status = promotion.workflowStatus ?? 'draft'

  const tokenMap: Record<string, string> = {}
  const tokens = (
    promotion.campaign?.previewContext as {tokens?: Array<{key?: string; sample?: string}>} | null
  )?.tokens
  if (tokens) {
    for (const t of tokens) {
      if (t.key && t.sample) tokenMap[t.key] = t.sample
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f5] py-12 px-4 font-[Arial,Helvetica,sans-serif]">
      <div className="mx-auto max-w-150">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={`/campaigns/${promotion.campaign?._id ?? ''}`}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ← Campaign
          </Link>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${workflowColors[status] ?? workflowColors['draft']}`}
          >
            {status.replace('-', ' ')}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
            Tokens resolved with sample data
          </span>
        </div>

        <div className="mb-6 space-y-1">
          {promotion.segment?.name ? (
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              {promotion.segment.name}
            </p>
          ) : (
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Base variant
            </p>
          )}
          {promotion.subjectLine && (
            <h1 className="text-xl font-semibold text-gray-900">
              {resolveTokens(promotion.subjectLine, tokenMap)}
            </h1>
          )}
          {promotion.preheader && (
            <p className="text-sm text-gray-500">{resolveTokens(promotion.preheader, tokenMap)}</p>
          )}
        </div>

        <div className="overflow-hidden bg-white">
          {promotion.disruptor && (
            <div className="bg-[#111111] py-2 text-center">
              <p className="text-[11px] font-bold tracking-[3px] uppercase text-white">
                {resolveTokens(promotion.disruptor, tokenMap)}
              </p>
            </div>
          )}

          {promotion.emailSlots && promotion.emailSlots.length > 0 ? (
            <div>
              {promotion.emailSlots.map((block) => (
                <EmailBlockPreview key={block._key} block={block} tokenMap={tokenMap} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 text-sm">
              No email blocks yet. Open this promotion in Studio to add content.
            </div>
          )}
        </div>

        {promotion.campaignPerformance && (
          <div className="mt-6 grid grid-cols-3 gap-4">
            {promotion.campaignPerformance.openRate != null && (
              <Metric label="Open Rate" value={`${promotion.campaignPerformance.openRate}%`} />
            )}
            {promotion.campaignPerformance.clickThroughRate != null && (
              <Metric label="CTR" value={`${promotion.campaignPerformance.clickThroughRate}%`} />
            )}
            {promotion.campaignPerformance.conversionRate != null && (
              <Metric
                label="Conversion"
                value={`${promotion.campaignPerformance.conversionRate}%`}
              />
            )}
          </div>
        )}
      </div>
    </main>
  )
}

function EmailBlockPreview({
  block,
  tokenMap,
}: {
  block: {_key: string; _type: string; [key: string]: unknown}
  tokenMap: Record<string, string>
}) {
  const r = (text: string) => resolveTokens(text, tokenMap)
  switch (block._type) {
    case 'emailHeader': {
      const b = block as {_key: string; _type: string; brandName?: string; logoImageUrl?: string}
      return (
        <div className="bg-white px-8 py-4 text-center">
          {b.logoImageUrl ? (
            <img src={b.logoImageUrl} alt={b.brandName ?? ''} className="mx-auto w-37.5 py-4" />
          ) : b.brandName ? (
            <p className="text-lg font-bold text-[#111111]">{r(b.brandName)}</p>
          ) : null}
        </div>
      )
    }
    case 'emailSection': {
      const b = block as {
        _key: string
        _type: string
        headline?: string
        body?: string
        imageUrl?: string
        products?: Array<{
          _id: string
          title?: string
          price?: number
          url?: string
          imageUrl?: string
        }>
      }
      return (
        <div className="bg-white">
          {b.imageUrl && <img src={b.imageUrl} alt="" className="block w-full" />}
          {(b.headline || b.body) && (
            <div className="px-8 py-6">
              {b.headline && (
                <h2 className="pb-2 text-[22px] font-bold text-[#111111]">{r(b.headline)}</h2>
              )}
              {b.body && (
                <p className="pb-4 text-[15px] leading-[1.6] text-[#555555]">{r(b.body)}</p>
              )}
            </div>
          )}
          {b.products && b.products.length > 0 && (
            <div className="grid grid-cols-2 gap-4 px-8 py-4">
              {b.products.map((p) => (
                <div key={p._id} className="text-center">
                  {p.imageUrl && (
                    <img src={p.imageUrl} alt={p.title ?? ''} className="w-full pb-2" />
                  )}
                  {p.title && <p className="text-[14px] font-bold text-[#111111]">{p.title}</p>}
                  {p.price != null && (
                    <p className="text-[13px] text-[#555555]">${p.price.toFixed(2)}</p>
                  )}
                  {p.url && (
                    <a
                      href={p.url}
                      className="mt-2 inline-block rounded bg-[#111111] px-4 py-2 text-[12px] text-white"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
    case 'emailCTA': {
      const b = block as {_key: string; _type: string; text?: string; url?: string; style?: string}
      if (!b.text || !b.url) return null
      const isPrimary = b.style !== 'secondary'
      return (
        <div className="bg-white px-8 py-4 text-center">
          <a
            href={b.url}
            className={`inline-block rounded px-6 py-3 text-[14px] font-medium ${isPrimary ? 'bg-[#111111] text-white' : 'border border-[#111111] bg-white text-[#111111]'}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {b.text}
          </a>
        </div>
      )
    }
    case 'emailDivider': {
      const b = block as {_key: string; _type: string; spacing?: string}
      const spacingClass = b.spacing === 'small' ? 'py-2' : b.spacing === 'large' ? 'py-8' : 'py-4'
      return (
        <div className={spacingClass}>
          <hr className="border-[#eeeeee]" />
        </div>
      )
    }
    case 'emailFooter': {
      const b = block as {_key: string; _type: string; legalText?: string; unsubscribeText?: string}
      return (
        <div className="bg-white p-6 text-center text-[11px] text-[#aaaaaa]">
          {b.legalText && <p className="mb-2">{r(b.legalText)}</p>}
          <p>{b.unsubscribeText ?? 'Unsubscribe'}</p>
        </div>
      )
    }
    default:
      return null
  }
}

function Metric({label, value}: {label: string; value: string}) {
  return (
    <div className="border border-gray-100 rounded-lg p-4 text-center">
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  )
}
