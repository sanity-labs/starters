// --- Intl-powered locale utilities ---

const languageNames = new Intl.DisplayNames('en', {type: 'language', fallback: 'none'})
const regionNames = new Intl.DisplayNames('en', {type: 'region', fallback: 'none'})

/**
 * Validate a BCP-47 locale code (e.g., "en-US", "ja-JP", "zh-Hans-CN").
 *
 * Three checks are performed:
 * 1. Is the code structurally valid? (rejects "en_US", "en-", etc.)
 * 2. Does it only contain a language, script, and/or region? (rejects made-up suffixes)
 * 3. Are the language and region actually real? (rejects "abc-XY", "english")
 */
export function isValidLocale(code: string | undefined): boolean {
  if (!code) return false
  try {
    Intl.getCanonicalLocales(code)

    const locale = new Intl.Locale(code)
    const parts = [locale.language, locale.script, locale.region].filter(Boolean)
    if (parts.join('-') !== locale.baseName) return false

    if (!languageNames.of(locale.language)) return false
    if (locale.region && !regionNames.of(locale.region)) return false

    return true
  } catch {
    return false
  }
}

// Derive text direction from Intl.Locale (getTextInfo is a V8/Node 18+ extension)
type LocaleWithTextInfo = Intl.Locale & {
  textInfo?: {direction: string}
  getTextInfo?: () => {direction: string}
}

/**
 * Convert a region code (e.g., "US") to its flag emoji using regional indicator symbols.
 */
export function regionToFlag(region: string): string {
  return [...region.toUpperCase()]
    .map((ch) => String.fromCodePoint(ch.charCodeAt(0) - 0x41 + 0x1f1e6))
    .join('')
}

/**
 * Derive a flag emoji from a full BCP-47 locale code (e.g., "en-US" → 🇺🇸).
 * Returns an empty string if the code has no region or is invalid.
 */
export function getFlagFromCode(localeCode: string): string {
  try {
    const locale = new Intl.Locale(localeCode)
    if (locale.region) return regionToFlag(locale.region)
  } catch {
    // ignore invalid codes
  }
  return ''
}

/**
 * Derive locale metadata from a BCP-47 code using Intl APIs.
 * Returns display name, native name, text direction, and plural category count.
 */
export function resolveLocaleDefaults(code: string): {
  title: string
  nativeName: string
  direction: 'ltr' | 'rtl'
  pluralCategories: number
} {
  const locale = new Intl.Locale(code) as LocaleWithTextInfo
  const language = locale.language

  // Display name in English (e.g., "German (Germany)" for de-DE)
  const title = new Intl.DisplayNames('en', {type: 'language'}).of(code) ?? code

  // Display name in the locale's own language (e.g., "Deutsch" for de-DE)
  const nativeName = new Intl.DisplayNames(language, {type: 'language'}).of(language) ?? code

  // Text direction via Intl.Locale extension (V8/Node 18+)
  const textInfo = locale.textInfo ?? locale.getTextInfo?.()
  const direction: 'ltr' | 'rtl' = textInfo?.direction === 'rtl' ? 'rtl' : 'ltr'

  // Count distinct CLDR plural categories by probing representative numbers
  const pr = new Intl.PluralRules(code)
  const categories = new Set([0, 1, 2, 3, 5, 11, 21, 100, 1000000].map((n) => pr.select(n)))

  return {title, nativeName, direction, pluralCategories: categories.size}
}

// --- Intl-powered pluralization for Studio UI strings ---

const enPlural = new Intl.PluralRules('en')

function pluralize(count: number, one: string, other: string): string {
  return `${count} ${enPlural.select(count) === 'one' ? one : other}`
}

// --- Sanity schema validators ---

export function uniqueLocaleValidator(
  translations: {locale?: {_ref?: string}}[] | undefined,
): true | string {
  if (!translations) return true
  const refs = translations.map((t) => t.locale?._ref).filter(Boolean)
  const unique = new Set(refs)
  return unique.size === refs.length || 'Each locale may only appear once'
}

// --- Sanity Studio preview helpers ---

export function prepareGlossaryEntry({
  title,
  status,
  dnt,
}: {
  title?: string
  status?: string
  dnt?: boolean
}) {
  return {
    title: dnt ? `${title} [DNT]` : (title ?? ''),
    subtitle: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'No status',
  }
}

export function prepareGlossary({
  title,
  subtitle,
  entries,
}: {
  title?: string
  subtitle?: string
  entries?: unknown[]
}) {
  const count = entries?.length ?? 0
  return {
    title: title ?? '',
    subtitle: `${subtitle ?? ''} - ${pluralize(count, 'term', 'terms')}`,
  }
}
