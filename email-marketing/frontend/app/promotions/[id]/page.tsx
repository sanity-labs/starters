import Link from 'next/link'
import {notFound} from 'next/navigation'
import {sanityFetch} from '@/sanity/live'
import {promotionByIdQuery} from '@/sanity/queries'

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

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
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
      </div>

      <div className="mb-6 space-y-1">
        {promotion.segment?.name ? (
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {promotion.segment.name}
          </p>
        ) : (
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Base variant</p>
        )}
        {promotion.disruptor && (
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            {promotion.disruptor}
          </p>
        )}
        {promotion.subjectLine && (
          <h1 className="text-xl font-semibold text-gray-900">{promotion.subjectLine}</h1>
        )}
        {promotion.preheader && <p className="text-sm text-gray-500">{promotion.preheader}</p>}
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
        <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5">
          <p className="text-xs text-gray-400 font-medium">Tokens resolved with sample data</p>
        </div>

        {promotion.emailSlots && promotion.emailSlots.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {promotion.emailSlots.map((block) => (
              <EmailBlockPreview key={block._key} block={block} />
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
            <Metric label="Conversion" value={`${promotion.campaignPerformance.conversionRate}%`} />
          )}
        </div>
      )}
    </main>
  )
}

function EmailBlockPreview({
  block,
}: {
  block: {_key: string; _type: string; [key: string]: unknown}
}) {
  switch (block._type) {
    case 'emailHeader': {
      const b = block as {_key: string; _type: string; brandName?: string; logoImageUrl?: string}
      return (
        <div className="p-6 text-center">
          {b.logoImageUrl ? (
            <img src={b.logoImageUrl} alt={b.brandName ?? ''} className="h-10 mx-auto" />
          ) : b.brandName ? (
            <p className="text-lg font-bold text-gray-900">{b.brandName}</p>
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
        <div className="p-6">
          {b.imageUrl && (
            <div className="mb-4 bg-gray-100 rounded-lg overflow-hidden aspect-3/1">
              <img src={b.imageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {b.headline && <h2 className="text-lg font-semibold text-gray-900 mb-1">{b.headline}</h2>}
          {b.body && <p className="text-sm text-gray-600 mb-4">{b.body}</p>}
          {b.products && b.products.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              {b.products.map((p) => (
                <div key={p._id} className="text-center">
                  {p.imageUrl && (
                    <img src={p.imageUrl} alt={p.title ?? ''} className="w-full rounded-lg mb-2" />
                  )}
                  {p.title && <p className="text-sm font-semibold text-gray-900">{p.title}</p>}
                  {p.price != null && (
                    <p className="text-xs text-gray-500">${p.price.toFixed(2)}</p>
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
        <div className="p-6 text-center">
          <a
            href={b.url}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg ${isPrimary ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border border-gray-900'}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {b.text}
          </a>
        </div>
      )
    }
    case 'emailDivider':
      return <hr className="border-gray-100 mx-6" />
    case 'emailFooter': {
      const b = block as {_key: string; _type: string; legalText?: string; unsubscribeText?: string}
      return (
        <div className="p-6 text-center text-xs text-gray-400">
          {b.legalText && <p className="mb-2">{b.legalText}</p>}
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
