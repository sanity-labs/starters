import Link from 'next/link'

import {sanityFetch} from '@/sanity/live'
import {allCampaignsQuery} from '@/sanity/queries'

const statusColors: Record<string, string> = {
  planning: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
}

export default async function HomePage() {
  const {data: campaigns} = await sanityFetch({query: allCampaignsQuery})

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Campaigns</h1>
      <p className="text-gray-500 mb-8">Manage your email marketing campaigns</p>

      {campaigns.length === 0 ? (
        <p className="text-gray-400">No campaigns yet. Create one in the Studio.</p>
      ) : (
        <div className="grid gap-4">
          {campaigns.map(
            (campaign: {
              _id: string
              title: string
              slug: string
              status?: string
              description?: string
              list?: {name: string}
              emailCount: number
            }) => (
              <Link
                key={campaign._id}
                href={`/campaigns/${campaign.slug}`}
                className="block border border-gray-200 rounded-lg p-5 hover:border-gray-400 transition-colors"
                data-sanity={`campaign;${campaign._id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold truncate">{campaign.title}</h2>
                    {campaign.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {campaign.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-sm text-gray-500">
                      {campaign.list?.name && <span>{campaign.list.name}</span>}
                      <span>
                        {campaign.emailCount} {campaign.emailCount === 1 ? 'email' : 'emails'}
                      </span>
                    </div>
                  </div>
                  {campaign.status && (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusColors[campaign.status] ?? 'bg-gray-100 text-gray-800'}`}
                    >
                      {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </span>
                  )}
                </div>
              </Link>
            ),
          )}
        </div>
      )}
    </main>
  )
}
