import Link from 'next/link'
import {notFound} from 'next/navigation'
import {sanityFetch} from '@/sanity/live'
import {promotionsByCampaignQuery} from '@/sanity/queries'
import type {PromotionsByCampaignQueryResult} from 'sanity-types'

type Promotion = PromotionsByCampaignQueryResult[number]

const workflowColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  'in-review': 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  approved: 'bg-green-50 text-green-700 border border-green-200',
  sent: 'bg-blue-50 text-blue-700 border border-blue-200',
  rejected: 'bg-red-50 text-red-600 border border-red-200',
}

export default async function CampaignPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  const {data: promotions} = await sanityFetch({
    query: promotionsByCampaignQuery,
    params: {campaignId: id},
  })

  if (!promotions) notFound()

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-6">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
          ← Campaigns
        </Link>
      </div>

      {promotions.length === 0 ? (
        <p className="text-gray-400 text-sm">
          No promotions yet. Open this campaign in Studio and run Generate Promotions.
        </p>
      ) : (
        <div className="space-y-4">
          {promotions.map((p) => (
            <PromotionCard key={p._id} promotion={p} />
          ))}
        </div>
      )}
    </main>
  )
}

function PromotionCard({promotion}: {promotion: Promotion}) {
  const status = promotion.workflowStatus ?? 'draft'
  const segmentLabel = promotion.segment?.name ?? 'Unassigned'

  return (
    <Link
      href={`/promotions/${promotion._id}`}
      className="block border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-medium text-gray-500">{segmentLabel}</span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${workflowColors[status] ?? workflowColors['draft']}`}
        >
          {status.replace('-', ' ')}
        </span>
      </div>
      {promotion.subjectLine && (
        <p className="font-medium text-gray-900 text-sm">{promotion.subjectLine}</p>
      )}
      {promotion.preheader && (
        <p className="text-xs text-gray-400 mt-1 truncate">{promotion.preheader}</p>
      )}
      {promotion.disruptor && (
        <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">
          {promotion.disruptor}
        </p>
      )}
    </Link>
  )
}
