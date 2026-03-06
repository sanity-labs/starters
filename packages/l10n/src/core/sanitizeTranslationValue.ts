/**
 * Strip Unicode null bytes (\u0000) from translation values.
 *
 * The agent.action.translate API occasionally returns null bytes instead of
 * non-breaking spaces (\u00a0) in translated content. Sanity's API correctly
 * rejects documents containing null bytes, which causes cache writes to fail.
 *
 * Recursive because Portable Text blocks are nested objects with strings at
 * various depths — the null byte could be anywhere in the structure.
 */
export function sanitizeTranslationValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\u0000/g, '')
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeTranslationValue)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        sanitizeTranslationValue(v),
      ]),
    )
  }
  return value
}
