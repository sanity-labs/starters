// --- Intl-powered locale utilities ---

const languageNames = new Intl.DisplayNames(undefined, {type: 'language', fallback: 'none'})
const regionNames = new Intl.DisplayNames(undefined, {type: 'region', fallback: 'none'})

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
 * Returns display name and native name.
 */
export function resolveLocaleDefaults(code: string): {
  title: string
  nativeName: string
} {
  const language = new Intl.Locale(code).language

  // Display name in the user's locale (e.g., "German (Germany)" for de-DE on an English system)
  const title = new Intl.DisplayNames(undefined, {type: 'language'}).of(code) ?? code

  // Display name in the locale's own language (e.g., "Deutsch" for de-DE)
  const nativeName = new Intl.DisplayNames(language, {type: 'language'}).of(language) ?? code

  return {title, nativeName}
}

// --- Intl-powered pluralization for Studio UI strings ---

const localePlural = new Intl.PluralRules()

function pluralize(count: number, one: string, other: string): string {
  return `${count} ${localePlural.select(count) === 'one' ? one : other}`
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
