import Link from 'next/link'
import {sanityFetch} from '@/sanity/live'
import {LOCALES_QUERY} from '@/sanity/queries'
import type {Translation} from '@/sanity/types'
import {LocaleSwitcher, type LocaleLink} from '@/components/LocaleSwitcher'

/**
 * `translations` is the current page's rendition in each locale. Pass it on
 * pages that have one — every locale then links to its own slug instead of
 * reusing the current locale's, which is a 404. Omit it and every locale links
 * to its home page.
 */
export async function SiteNav({lang, translations}: {lang: string; translations?: Translation[]}) {
  'use cache'

  const {data: locales} = await sanityFetch({
    query: LOCALES_QUERY,
    perspective: 'published',
    stega: false,
  })

  const links: LocaleLink[] = locales.map((locale) => {
    const translation = translations?.find((entry) => entry.language === locale.code)
    return {
      code: locale.code,
      title: locale.title,
      nativeName: locale.nativeName,
      href: translation ? `/${locale.code}/${translation.slug}` : `/${locale.code}`,
      translated: !translations || Boolean(translation),
    }
  })

  return (
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
        <LocaleSwitcher locales={links} />
      </div>
    </nav>
  )
}
