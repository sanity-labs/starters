import {resolveFallbackChain} from './locales'
import type {Locale} from './types'

/**
 * The site's chrome, and the copy it falls back to.
 *
 * The values here are the last resort, not the source of truth: they are what
 * renders before anyone has seeded `l10n.uiStrings`, so a freshly initialised
 * project is not a wall of blank labels. Once the singleton exists, every
 * string comes from Sanity and moves through the same translation run as the
 * articles it frames.
 */
export const UI_STRING_DEFAULTS = {
  siteTitle: 'L10n Starter',
  siteTagline:
    'A minimal frontend demonstrating locale-filtered content from Sanity. Switch languages above to see articles in different locales.',
  articlesHeading: 'Articles',
  emptyArticles: 'No articles available in this language.',
  backToArticles: 'Back to articles',
  byline: 'By {name}',
  homeLabel: 'Home',
  architectureLabel: 'Architecture',
  fallbackNotice:
    'This article is not yet available in {locale}. Showing the {fallback} version — the fallback language configured in Sanity.',
} as const

export type UiStringKey = keyof typeof UI_STRING_DEFAULTS

export type UiStrings = Record<UiStringKey, string>

/**
 * One `internationalizedArray` field as the query returns it.
 *
 * Declared structurally rather than taken from the generated query type: the
 * resolver is the frontend's contract with the singleton, and it has to compile
 * both before `l10n.uiStrings` is registered in the Studio schema (TypeGen has
 * nothing to describe, so the projection types as `null`) and after.
 */
type StringEntries =
  | ReadonlyArray<{language?: string | null; value?: string | null} | null>
  | null
  | undefined

export type UiStringsDocument = {readonly [K in UiStringKey]?: StringEntries} | null | undefined

/**
 * Each string in the requested locale, falling back per string rather than per
 * document: a locale that has translated half its chrome shows that half, and
 * the rest walks the same `l10n.locale` fallback chain the articles do.
 */
export function resolveUiStrings(
  document: UiStringsDocument,
  language: string,
  locales: readonly Locale[],
): UiStrings {
  const candidates = [language, ...resolveFallbackChain(language, locales)]
  const resolved: UiStrings = {...UI_STRING_DEFAULTS}

  for (const key of Object.keys(UI_STRING_DEFAULTS)) {
    if (!isUiStringKey(key)) continue
    const value = pick(document?.[key], candidates)
    if (value !== undefined) resolved[key] = value
  }

  return resolved
}

/** Fills the `{token}` placeholders a string declares. */
export function formatUiString(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, token: string) => values[token] ?? match)
}

function pick(entries: StringEntries, candidates: readonly string[]): string | undefined {
  if (!entries) return undefined

  for (const candidate of candidates) {
    const entry = entries.find((item) => item?.language === candidate)
    if (entry?.value) return entry.value
  }

  return undefined
}

function isUiStringKey(key: string): key is UiStringKey {
  return key in UI_STRING_DEFAULTS
}
