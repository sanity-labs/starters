'use client'

import {useRouter, usePathname} from 'next/navigation'
import type {Locale} from '@/sanity/types'

function getFlagFromCode(code: string): string {
  const region = code.split('-')[1]
  if (!region || region.length !== 2) return ''
  return String.fromCodePoint(
    ...region
      .toUpperCase()
      .split('')
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  )
}

export function LocaleSwitcher({locales}: {locales: Locale[]}) {
  const router = useRouter()
  const pathname = usePathname()

  const currentLanguage = pathname.split('/')[1] || ''

  function handleSelect(code: string) {
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=${60 * 60 * 24 * 365}`
    const restOfPath = pathname.replace(/^\/[^/]+/, '')
    router.push(`/${code}${restOfPath}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {locales.map((locale) => {
        const flag = getFlagFromCode(locale.code)
        const abbr = locale.code.split('-')[0].toUpperCase()
        const isActive = locale.code === currentLanguage

        return (
          <button
            key={locale.code}
            onClick={() => handleSelect(locale.code)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-[var(--transition-fast)] cursor-pointer ${
              isActive
                ? 'bg-[var(--color-text-primary)] text-white shadow-[0_1px_8px_rgba(15,23,42,0.2)]'
                : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-primary)]/20 hover:text-[var(--color-text-primary)]'
            }`}
            title={locale.nativeName || locale.title}
          >
            {flag && <span className="text-base">{flag}</span>}
            {abbr}
          </button>
        )
      })}
    </div>
  )
}
