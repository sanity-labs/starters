import {describe, expect, it} from 'vitest'

import {generateLocalizedSlug} from './generateLocalizedSlug'

describe('generateLocalizedSlug', () => {
  it('slugifies a title and prefixes the locale path', () => {
    expect(generateLocalizedSlug('The Acme Widget Launch', 'es-MX')).toEqual({
      current: 'the-acme-widget-launch',
      fullUrl: '/es-mx/the-acme-widget-launch',
    })
  })

  it('strips diacritics and punctuation', () => {
    expect(generateLocalizedSlug('Café — crème brûlée!', 'fr-FR').current).toBe('cafe-creme-brulee')
  })

  // An ASCII-only filter emptied these, and an empty `current` collides with
  // every other document in the locale.
  it('keeps the script a non-Latin title is written in', () => {
    expect(generateLocalizedSlug('日本語のタイトル', 'ja-JP')).toEqual({
      current: '日本語のタイトル',
      fullUrl: '/ja-jp/日本語のタイトル',
    })
    expect(generateLocalizedSlug('مرحبا بالعالم', 'ar-SA').current).toBe('مرحبا-بالعالم')
    expect(generateLocalizedSlug('제품 출시', 'ko-KR').current).toBe('제품-출시')
  })

  // NFD splits a dakuten off its base and it is a `\p{M}`, so a mark filter
  // would turn が back into か — a different word.
  it('recomposes marks other scripts carry meaning in', () => {
    expect(generateLocalizedSlug('がっこうの本', 'ja-JP').current).toBe('がっこうの本')
    expect(generateLocalizedSlug('हिन्दी शीर्षक', 'hi-IN').current).toBe('हिन्दी-शीर्षक')
  })

  it('drops emoji and symbols rather than the words around them', () => {
    expect(generateLocalizedSlug('Launch 🚀 day: 50% off!', 'en-US').current).toBe(
      'launch-day-50-off',
    )
  })

  it('caps the slug at 60 characters', () => {
    const slug = generateLocalizedSlug('a'.repeat(80), 'de-DE').current
    expect(slug).toHaveLength(60)
  })

  it('never truncates through a surrogate pair', () => {
    const slug = generateLocalizedSlug('𝔞'.repeat(80), 'de-DE').current
    expect([...slug]).toHaveLength(60)
    expect(slug).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
  })
})
