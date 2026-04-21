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
            {promotion.emailSlots.map((slot) => (
              <div key={slot._key} className="p-6">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                  {slot.position?.replace('-', ' ')}
                </p>

                {slot.asset?.url && (
                  <div className="mb-4 bg-gray-100 rounded-lg overflow-hidden aspect-3/1">
                    <img
                      src={slot.asset.url}
                      alt={slot.asset.altText ?? ''}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {slot.headline && (
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">{slot.headline}</h2>
                )}
                {slot.subheadline && (
                  <p className="text-sm text-gray-600 mb-4">{slot.subheadline}</p>
                )}
                {slot.cta?.text && slot.cta.url && (
                  <a
                    href={slot.cta.url}
                    className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {slot.cta.text}
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400 text-sm">
            No email slots yet. Open this promotion in Studio to add content.
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
    </main>
  )
}

function Metric({label, value}: {label: string; value: string}) {
  return (
    <div className="border border-gray-100 rounded-lg p-4 text-center">
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  )
}
