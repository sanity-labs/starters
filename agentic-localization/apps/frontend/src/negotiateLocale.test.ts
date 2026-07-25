import {describe, expect, it} from 'vitest'

import {negotiateLocale, parseAcceptLanguage} from './negotiateLocale'

describe('parseAcceptLanguage', () => {
  it('orders ranges by q, most preferred first', () => {
    expect(parseAcceptLanguage('fr-FR;q=0.5,de-DE,ja-JP;q=0.8')).toEqual([
      'de-DE',
      'ja-JP',
      'fr-FR',
    ])
  })

  it('keeps header order between equally weighted ranges', () => {
    expect(parseAcceptLanguage('de-DE,fr-FR,ja-JP')).toEqual(['de-DE', 'fr-FR', 'ja-JP'])
  })

  it('drops ranges the client marked unacceptable', () => {
    expect(parseAcceptLanguage('de-DE;q=0,fr-FR')).toEqual(['fr-FR'])
  })

  it('is empty for a missing or blank header', () => {
    expect(parseAcceptLanguage(null)).toEqual([])
    expect(parseAcceptLanguage('')).toEqual([])
  })
})

describe('negotiateLocale', () => {
  it('takes the highest weighted range it can express as a locale', () => {
    expect(negotiateLocale('fr-FR;q=0.5,de-DE;q=0.9')).toBe('de-DE')
  })

  it('canonicalizes case rather than rejecting it', () => {
    expect(negotiateLocale('DE-de')).toBe('de-DE')
  })

  it('adds the likely region to a bare language', () => {
    expect(negotiateLocale('ja')).toBe('ja-JP')
    expect(negotiateLocale('de')).toBe('de-DE')
  })

  it('resolves a script subtag to its region', () => {
    expect(negotiateLocale('zh-Hans')).toBe('zh-CN')
  })

  it('skips the wildcard and malformed ranges', () => {
    expect(negotiateLocale('*')).toBeNull()
    expect(negotiateLocale('not a language,de-DE')).toBe('de-DE')
  })

  it('is null when the client stated no preference', () => {
    expect(negotiateLocale(null)).toBeNull()
  })
})
