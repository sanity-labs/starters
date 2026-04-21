import Link from 'next/link'
import {sanityFetch} from '@/sanity/live'
import {allCampaignsQuery} from '@/sanity/queries'

const statusDot: Record<string, string> = {
  draft: 'bg-gray-300',
  'in-review': 'bg-yellow-400',
  approved: 'bg-green-500',
  sent: 'bg-blue-500',
}

const tierColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  mid: 'bg-blue-50 text-blue-700',
  high: 'bg-purple-50 text-purple-700',
  vip: 'bg-amber-50 text-amber-700',
}

function formatDate(d: string | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})
}

export default async function HomePage() {
  const {data: campaigns} = await sanityFetch({query: allCampaignsQuery})

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <p className="text-sm text-gray-500 mt-1">
          Each campaign generates segment-variant promotions for review and send.
        </p>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-gray-400 text-sm">
          No campaigns yet. Create a Campaign brief in the Studio, then run Generate Variants.
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {campaigns.map((campaign) => (
            <div key={campaign._id} className="py-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <h2 className="font-medium text-gray-900 truncate">{campaign.title}</h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {campaign.store?.title && <span>{campaign.store.title}</span>}
                    {campaign.urgencyStage?.title && (
                      <span className="border border-gray-200 rounded px-1.5 py-0.5">
                        {campaign.urgencyStage.title}
                      </span>
                    )}
                    {campaign.startDate && (
                      <span>
                        {formatDate(campaign.startDate)}
                        {campaign.endDate && ` – ${formatDate(campaign.endDate)}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500 shrink-0">
                  <div>
                    {campaign.approvedCount}/{campaign.promotionCount} approved
                  </div>
                </div>
              </div>

              {campaign.segments && campaign.segments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {campaign.segments.map((seg) => (
                    <Link
                      key={seg._id}
                      href={`/campaigns/${campaign._id}`}
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${tierColors[seg.engagementTier ?? 'mid'] ?? tierColors['mid']}`}
                    >
                      {seg.name}
                    </Link>
                  ))}
                </div>
              )}

              {campaign.toneTraits && campaign.toneTraits.length > 0 && (
                <div className="flex flex-wrap gap-1 text-xs text-gray-400">
                  {campaign.emotionalGoal && (
                    <span className="font-medium text-gray-500">{campaign.emotionalGoal}</span>
                  )}
                  {campaign.toneTraits.map((t, i) => (
                    <span key={i}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
