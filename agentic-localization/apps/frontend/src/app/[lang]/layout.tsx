// TODO: Add Sanity Presentation tool / Visual Editing
// - Add <VisualEditing /> from next-sanity in layout
// - Add @sanity/presentation plugin to studio/sanity.config.ts
// - Set up draft mode API route + preview secret
// - Add data-sanity attributes or createDataAttribute for click-to-edit
import type {Metadata} from 'next'
import {draftMode} from 'next/headers'
import {Suspense} from 'react'
import '../globals.css'
import {sanityFetch, SanityLive} from '@/sanity/live'
import {DEFAULT_LANGUAGE, LOCALES_QUERY} from '@/sanity/queries'
import {SITE_URL} from '@/site'

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: 'L10n Starter Frontend',
  description:
    'A minimal demo showing how to query and display localized Sanity content with the l10n plugin.',
}

export async function generateStaticParams() {
  'use cache'

  const {data: locales} = await sanityFetch({
    query: LOCALES_QUERY,
    perspective: 'published',
    stega: false,
  })

  // Cache Components treats an empty set as a build error, and a project whose
  // locales have not been seeded yet is a legitimate first-run state.
  if (locales.length === 0) return [{lang: DEFAULT_LANGUAGE}]

  return locales.map((locale) => ({lang: locale.code}))
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{lang: string}>
}) {
  const {lang} = await params

  return (
    <html lang={lang}>
      <body className="min-h-screen antialiased">
        {/* Each page renders its own <SiteNav />: only the page knows which
            slug the current document has in every other locale. */}
        <div className="mx-auto max-w-3xl px-4 py-10">{children}</div>
        <Suspense>
          <LiveContent />
        </Suspense>
      </body>
    </html>
  )
}

/** `draftMode()` is request data, so it stays outside every cache boundary. */
async function LiveContent() {
  const {isEnabled} = await draftMode()
  return <SanityLive includeDrafts={isEnabled} />
}
