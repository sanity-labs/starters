import {DEFAULT_LANGUAGE} from './queries'
import type {Locale, Translation} from './types'

/**
 * The locales to try, in order, when `language` has no translation. Follows the
 * `fallback` reference on `l10n.locale` for as many hops as it is configured
 * for, stopping on a cycle, and ends at the default language — the source
 * locale is the last resort even when no editor wired a chain up to it.
 */
export function resolveFallbackChain(language: string, locales: Locale[]): string[] {
  const byCode = new Map(locales.map((locale) => [locale.code, locale]))
  const chain: string[] = []
  const seen = new Set([language])

  let next = byCode.get(language)?.fallback
  while (next && !seen.has(next)) {
    seen.add(next)
    chain.push(next)
    next = byCode.get(next)?.fallback
  }

  if (!seen.has(DEFAULT_LANGUAGE)) chain.push(DEFAULT_LANGUAGE)

  return chain
}

/**
 * Every locale the document is published in, one entry per language. The
 * document itself is included: one with no `translation.metadata` join yet is
 * still its own only translation.
 */
export function listTranslations(article: {
  language: string
  slug: string
  translations: Translation[] | null
}): Translation[] {
  const byLanguage = new Map<string, Translation>([
    [article.language, {language: article.language, slug: article.slug}],
  ])

  for (const entry of article.translations ?? []) byLanguage.set(entry.language, entry)

  return [...byLanguage.values()]
}
