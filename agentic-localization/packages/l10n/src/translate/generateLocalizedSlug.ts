/**
 * Script-preserving, not ASCII-only: a `[^a-z0-9]` filter empties the slug of
 * every ja/zh/ko/ar title, and an empty `current` collides across every
 * document in that locale. Latin diacritics are folded (`café` → `cafe`), marks
 * other scripts need are kept (`\p{M}` covers dakuten, matras, harakat — NFD
 * splits them off their base and dropping them would rewrite the word).
 *
 * Studio's own Slug input transliterates instead, via `speakingurl`, which it
 * does not export. Left unadopted: `speakingurl` ships no resolvable types
 * (`typings/` is not referenced from its `package.json`) and adds 16–40 KB to
 * every Function bundle, to ASCII-fold every script (and `ß` → `ss`).
 */
export function generateLocalizedSlug(
  title: string,
  localeCode: string,
): {current: string; fullUrl: string} {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Fold Latin diacritics
    .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, '') // Drop punctuation, symbols, emoji
    .normalize('NFC')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  // By code point: a `slice` mid-surrogate would emit a lone half, which the
  // mutate endpoint rejects (see `sanitizeTranslationValue`).
  const current = [...slug].slice(0, 60).join('')
  const fullUrl = `/${localeCode.toLowerCase()}/${current}`

  return {current, fullUrl}
}
