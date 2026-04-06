import Link from 'next/link'

import {sanityFetch} from '@/sanity/live'
import {emailByIdQuery} from '@/sanity/queries'
import {EmailPreview} from './email-preview'

export default async function EmailPreviewPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  const {data: email} = await sanityFetch({query: emailByIdQuery, params: {id}})

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-500">Email not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-150">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-black transition-colors mb-4 inline-block"
        >
          &larr; All emails
        </Link>
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <p className="text-lg font-semibold text-gray-900">{email.subject ?? 'No subject'}</p>
            {email.preheader && <p className="mt-1 text-sm text-gray-400">{email.preheader}</p>}
          </div>
          <EmailPreview body={email.body} />
        </div>
      </div>
    </div>
  )
}
