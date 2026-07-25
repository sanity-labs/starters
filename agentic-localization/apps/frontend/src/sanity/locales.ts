import {DEFAULT_LANGUAGE} from './queries'
import type {Locale, Translation} from './types'

/**
 * The locales to try, in order, when `language` has no translation. Follows the
 * `fallback` reference on `l10n.locale` for as many hops as it is configured
 * for, stopping on a cycle, and ends at the default language — the source
 * locale is the last resort even when no editor wired a chain up to it.
 */
export function resolveFallbackChain(language: string, locales: readonly Locale[]): string[] {
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

/** A document and the siblings it joins to, as the queries project them. */
interface Translatable {
  language: string | null
  slug: string | null
  translations: ReadonlyArray<{language: string | null; slug: string | null} | null> | null
}

/**
 * Every locale the document is published in, one entry per language. The
 * document itself is included: one with no `translation.metadata` join yet is
 * still its own only translation. An entry missing either half of the pair is
 * dropped — there is no URL to link it to.
 */
export function listTranslations(article: Translatable): Translation[] {
  const own = {language: article.language, slug: article.slug}
  const byLanguage = new Map<string, Translation>()

  for (const entry of [own, ...(article.translations ?? [])]) {
    if (entry?.language && entry.slug) {
      byLanguage.set(entry.language, {language: entry.language, slug: entry.slug})
    }
  }

  return [...byLanguage.values()]
}
