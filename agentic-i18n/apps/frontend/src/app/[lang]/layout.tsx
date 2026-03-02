// TODO: Add Sanity Presentation tool / Visual Editing
// - Add <VisualEditing /> from next-sanity in layout
// - Add @sanity/presentation plugin to studio/sanity.config.ts
// - Set up draft mode API route + preview secret
// - Add data-sanity attributes or createDataAttribute for click-to-edit
import type {Metadata} from 'next'
import Link from 'next/link'
import '../globals.css'
import {sanityFetch} from '@/sanity/fetch'
import {LOCALES_QUERY} from '@/sanity/queries'
import type {Locale} from '@/sanity/types'
import {LocaleSwitcher} from '@/components/LocaleSwitcher'

export const metadata: Metadata = {
  title: 'L10n Starter Frontend',
  description:
    'A minimal demo showing how to query and display localized Sanity content with the l10n plugin.',
}

export async function generateStaticParams() {
  const locales = await sanityFetch<Locale[]>(LOCALES_QUERY)
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
  const locales = await sanityFetch<Locale[]>(LOCALES_QUERY)

  return (
    <html lang={lang}>
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <nav className="mb-10 flex items-center justify-between">
            <Link
              href={`/${lang}`}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-[color] duration-[var(--transition-fast)]"
              title="Home"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-6"
              >
                <path
                  fillRule="evenodd"
                  d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href={`/${lang}/architecture`}
                className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-[color] duration-[var(--transition-fast)]"
              >
                Architecture
              </Link>
              <div className="h-4 w-px bg-[var(--color-border)]" />
              <LocaleSwitcher locales={locales} />
            </div>
          </nav>
          <div className="animate-fade-in">{children}</div>
        </div>
      </body>
    </html>
  )
}
