import {client} from '@/sanity/client'
import {emailByIdQuery} from '@/sanity/queries'
import {assembleEmailMjml} from '@/lib/email/mjml'
import mjml2html from 'mjml'
import CopyHtmlButton from './copy-html-button'

export default async function EmailPreviewPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  const email = await client.fetch(emailByIdQuery, {id})

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-500">Email not found</p>
      </div>
    )
  }

  const mjmlString = assembleEmailMjml(email)
  const {html} = mjml2html(mjmlString)

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{email.title}</h1>
              {email.campaign && (
                <p className="mt-1 text-sm text-gray-500">Campaign: {email.campaign.title}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <CopyHtmlButton html={html} />
              <span className="text-xs text-gray-400">
                Paste into your email service provider (e.g., Klaviyo, Mailchimp)
              </span>
            </div>
          </div>
          {email.sendState === 'sent' && email.lastSentAt && (
            <div className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">
              Sent on{' '}
              {new Date(email.lastSentAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>
          )}
          {email.sendState === 'error' && (
            <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
              Send failed — check Studio for details
            </div>
          )}
          {email.sendState === 'sending' && (
            <div className="rounded-md bg-blue-50 px-4 py-2 text-sm text-blue-700">Sending…</div>
          )}
          <div className="space-y-2 border-t pt-4">
            <div className="flex gap-2">
              <span className="text-sm font-medium text-gray-500">Subject:</span>
              <span className="text-sm text-gray-900">{email.subject ?? 'No subject'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-sm font-medium text-gray-500">Preheader:</span>
              <span className="text-sm text-gray-900">{email.preheader ?? 'No preheader'}</span>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <iframe srcDoc={html} title="Email preview" className="h-200 w-full border-0" />
        </div>
      </div>
    </div>
  )
}
