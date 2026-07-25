/**
 * Not `@starter/l10n`'s `isValidLocale`: the frontend depends on no workspace
 * package, so it can be cloned on its own. Must match the locale codes seeded
 * in `l10n.locale` — the same rule as `DEFAULT_LANGUAGE` in `sanity/queries.ts`.
 */
export const LOCALE_PATTERN = /^[a-z]{2}-[A-Z]{2}$/

/**
 * The tags of an `Accept-Language` header, most preferred first.
 *
 * RFC 9110: comma-separated ranges, each optionally weighted `;q=`, defaulting
 * to 1. `q=0` means "not acceptable" and is dropped. The sort is stable, so
 * equally weighted ranges keep the order the client sent them in.
 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return []

  return header
    .split(',')
    .flatMap((range) => {
      const [tag, ...parameters] = range.trim().split(';')
      if (!tag) return []

      const weight = parameters
        .map((parameter) => /^q=(.+)$/i.exec(parameter.trim())?.[1])
        .find((value) => value !== undefined)
      const quality = weight === undefined ? 1 : Number.parseFloat(weight)

      return Number.isFinite(quality) && quality > 0 ? [{tag, quality}] : []
    })
    .sort((a, b) => b.quality - a.quality)
    .map((range) => range.tag)
}

/**
 * The locale to serve a request that asked for no locale in its path, or `null`
 * when nothing the client accepts can be expressed as one.
 *
 * `Intl.Locale` does the work a hand-rolled parser would get wrong: it
 * canonicalizes case (`en-us` → `en-US`), and `maximize()` adds the likely
 * region CLDR records for a bare language, so `de` resolves to `de-DE` and
 * `zh-Hans` to `zh-CN` rather than being discarded.
 */
export function negotiateLocale(header: string | null | undefined): string | null {
  for (const tag of parseAcceptLanguage(header)) {
    const locale = toLocaleCode(tag)
    if (locale) return locale
  }

  return null
}

function toLocaleCode(tag: string): string | null {
  if (tag === '*') return null

  try {
    const {language, region} = new Intl.Locale(tag).maximize()
    const code = `${language}-${region}`
    return LOCALE_PATTERN.test(code) ? code : null
  } catch {
    // A malformed range is a client problem, not a reason to fail the request.
    return null
  }
}
