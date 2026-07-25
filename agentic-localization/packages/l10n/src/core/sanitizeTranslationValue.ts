import {isRecord} from './isRecord'

/**
 * Strip the code points Sanity's mutate endpoint rejects from translation
 * values.
 *
 * The agent.action.translate API occasionally returns a null byte instead of a
 * non-breaking space (\u00a0), and a truncated response can end mid-surrogate.
 * The endpoint answers any of these with `validationError: 'Invalid Unicode
 * character at offset N'` and fails the whole transaction — one bad code point
 * in one field loses every write in it.
 *
 * The pattern is the one `sanity-io/atlas` uses (`lib/sanitize-unicode.ts`):
 * NULL, the two non-characters, and either half of a surrogate pair without
 * its partner. Well-formed pairs — every emoji and CJK extension — pass.
 *
 * Recursive because Portable Text blocks are nested objects with strings at
 * various depths — the code point could be anywhere in the structure.
 */
const INVALID_UNICODE_RE =
  /[\u0000\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

export function sanitizeTranslationValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(INVALID_UNICODE_RE, '')
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeTranslationValue)
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeTranslationValue(v)]),
    )
  }
  return value
}
