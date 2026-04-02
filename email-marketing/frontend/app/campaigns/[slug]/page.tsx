import Link from 'next/link'
import {notFound} from 'next/navigation'

import {sanityFetch} from '@/sanity/live'
import {campaignBySlugQuery, campaignSlugsQuery} from '@/sanity/queries'

type Props = {
  params: Promise<{slug: string}>
}

const statusColors: Record<string, string> = {
  planning: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  draft: 'bg-gray-100 text-gray-600',
  'ready-for-review': 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  sent: 'bg-purple-100 text-purple-800',
}

function StatusBadge({status}: {status: string | null}) {
  if (!status) return null
  const label = status
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status] ?? 'bg-gray-100 text-gray-800'}`}
    >
      {label}
    </span>
  )
}

export async function generateStaticParams() {
  const {data} = await sanityFetch({
    query: campaignSlugsQuery,
    perspective: 'published',
    stega: false,
  })
  return data
}

export default async function CampaignPage(props: Props) {
  const params = await props.params
  const {data: campaign} = await sanityFetch({query: campaignBySlugQuery, params})

  if (!campaign?._id) {
    return notFound()
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <Link
        href="/"
        className="text-sm text-gray-500 hover:text-black transition-colors mb-6 inline-block"
      >
        &larr; All campaigns
      </Link>

      <div className="mb-8" data-sanity={`campaign;${campaign._id}`}>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">{campaign.title}</h1>
          <StatusBadge status={campaign.status} />
        </div>
        {campaign.description && <p className="text-gray-500 mt-2">{campaign.description}</p>}
        {campaign.list?.name && (
          <p className="text-sm text-gray-400 mt-3">
            List: <span className="text-gray-600">{campaign.list.name}</span>
          </p>
        )}
      </div>

      {campaign.audiences && campaign.audiences.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
            Audiences
          </h2>
          <div className="flex flex-wrap gap-2">
            {campaign.audiences.map((audience: {_id: string; name: string}) => (
              <span
                key={audience._id}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-50 text-indigo-700"
              >
                {audience.name}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">Emails</h2>
        {!campaign.emails || campaign.emails.length === 0 ? (
          <p className="text-gray-400">No emails in this campaign yet.</p>
        ) : (
          <div className="grid gap-3">
            {campaign.emails.map(
              (email: {
                _id: string
                title: string
                subject?: string
                status?: string | null
                audience?: {name: string}
              }) => (
                <Link
                  key={email._id}
                  href={`/emails/preview/${email._id}`}
                  className="block border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors"
                  data-sanity={`email;${email._id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">{email.title}</h3>
                      {email.subject && (
                        <p className="text-sm text-gray-500 mt-1 truncate">
                          Subject: {email.subject}
                        </p>
                      )}
                      {email.audience?.name && (
                        <p className="text-xs text-gray-400 mt-1">
                          Audience: {email.audience.name}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={email.status ?? null} />
                  </div>
                </Link>
              ),
            )}
          </div>
        )}
      </section>
    </main>
  )
}
