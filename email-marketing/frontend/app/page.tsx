import Link from 'next/link'

import {sanityFetch} from '@/sanity/live'
import {allEmailsQuery} from '@/sanity/queries'

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  'ready-for-review': 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  sent: 'bg-purple-100 text-purple-800',
}

export default async function HomePage() {
  const {data: emails} = await sanityFetch({query: allEmailsQuery})

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Emails</h1>
      <p className="text-gray-500 mb-8">Manage your email marketing campaigns</p>

      {emails.length === 0 ? (
        <p className="text-gray-400">No emails yet. Create one in the Studio.</p>
      ) : (
        <div className="grid gap-4">
          {emails.map(
            (email: {
              _id: string
              title: string
              subject?: string
              status?: string
              campaigns?: Array<{title: string}>
            }) => (
              <Link
                key={email._id}
                href={`/emails/preview/${email._id}`}
                className="block border border-gray-200 rounded-lg p-5 hover:border-gray-400 transition-colors"
                data-sanity={`emailMessage;${email._id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold truncate">{email.title}</h2>
                    {email.subject && (
                      <p className="text-sm text-gray-500 mt-1 truncate">
                        Subject: {email.subject}
                      </p>
                    )}
                    {email.campaigns && email.campaigns.length > 0 && (
                      <p className="text-xs text-gray-400 mt-2">
                        {email.campaigns.length === 1
                          ? `Campaign: ${email.campaigns[0].title}`
                          : `Campaigns: ${email.campaigns.map((c) => c.title).join(', ')}`}
                      </p>
                    )}
                  </div>
                  {email.status && (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusColors[email.status] ?? 'bg-gray-100 text-gray-800'}`}
                    >
                      {email.status
                        .split('-')
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ')}
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
