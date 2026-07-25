'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'

export interface LocaleLink {
  code: string
  title: string
  nativeName: string | null
  /** This locale's own URL for the current page, or its home page. */
  href: string
  /** False when the current page has no rendition in this locale. */
  translated: boolean
}

/**
 * Copied from `packages/l10n/src/core/utils.ts` — `Intl.Locale` resolves the
 * region of any BCP-47 tag, including script subtags like `zh-Hans-CN` that a
 * `split('-')[1]` reads as `Hans`. Copied rather than imported: this app takes
 * no workspace dependency, so it stays a plain Next app you can lift out.
 */
function getFlagFromCode(localeCode: string): string {
  try {
    const {region} = new Intl.Locale(localeCode)
    if (region) {
      return [...region.toUpperCase()]
        .map((ch) => String.fromCodePoint(ch.charCodeAt(0) - 0x41 + 0x1f1e6))
        .join('')
    }
  } catch {
    // ignore invalid codes
  }
  return ''
}

function rememberLocale(code: string) {
  document.cookie = `NEXT_LOCALE=${code};path=/;max-age=${60 * 60 * 24 * 365}`
}

export function LocaleSwitcher({locales}: {locales: LocaleLink[]}) {
  const pathname = usePathname()
  const currentLanguage = pathname.split('/')[1] || ''

  return (
    <div className="flex flex-wrap gap-2">
      {locales.map((locale) => {
        const flag = getFlagFromCode(locale.code)
        const abbr = locale.code.split('-')[0].toUpperCase()
        const isActive = locale.code === currentLanguage
        const name = locale.nativeName || locale.title

        return (
          <Link
            key={locale.code}
            href={locale.href}
            hrefLang={locale.code}
            onClick={() => rememberLocale(locale.code)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-[var(--transition-fast)] ${
              isActive
                ? 'bg-[var(--color-text-primary)] text-white shadow-[0_1px_8px_rgba(15,23,42,0.2)]'
                : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-primary)]/20 hover:text-[var(--color-text-primary)]'
            } ${locale.translated ? '' : 'opacity-50'}`}
            title={locale.translated ? name : `${name} — not translated yet`}
          >
            {flag && <span className="text-base">{flag}</span>}
            {abbr}
          </Link>
        )
      })}
    </div>
  )
}
