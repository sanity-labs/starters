import {describe, it, expect} from 'vitest'
import {
  isValidLocale,
  resolveLocaleDefaults,
  regionToFlag,
  uniqueLocaleValidator,
  prepareGlossaryEntry,
  prepareGlossary,
} from './utils'

describe('isValidLocale', () => {
  // BCP-47 is case-insensitive — Intl.Locale normalises casing
  const valid = [
    'en',
    'en-US',
    'de-DE',
    'zh-Hans',
    'zh-Hans-CN',
    'pt-BR',
    'fra',
    'sr-Latn-RS',
    'EN',
    'en-us',
  ]
  const invalid = ['e', 'en_US', '123', '', 'en-', '-US', 'abc-XY', 'english']

  it.each(valid)('accepts valid code: %s', (code) => {
    expect(isValidLocale(code)).toBe(true)
  })

  it.each(invalid)('rejects invalid code: %s', (code) => {
    expect(isValidLocale(code)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isValidLocale(undefined)).toBe(false)
  })
})

describe('resolveLocaleDefaults', () => {
  it('derives display name and native name for de-DE', () => {
    const result = resolveLocaleDefaults('de-DE')
    expect(result.title).toBe('German (Germany)')
    expect(result.nativeName).toBe('Deutsch')
  })

  it('derives native name in locale language', () => {
    expect(resolveLocaleDefaults('fr-FR').nativeName).toBe('français')
    expect(resolveLocaleDefaults('ja-JP').nativeName).toBe('日本語')
  })

  it('handles language-only codes without region', () => {
    const result = resolveLocaleDefaults('en')
    expect(result.title).toBe('English')
  })
})

describe('regionToFlag', () => {
  it('converts region codes to flag emoji', () => {
    expect(regionToFlag('US')).toBe('🇺🇸')
    expect(regionToFlag('DE')).toBe('🇩🇪')
    expect(regionToFlag('JP')).toBe('🇯🇵')
    expect(regionToFlag('SA')).toBe('🇸🇦')
    expect(regionToFlag('BR')).toBe('🇧🇷')
    expect(regionToFlag('CN')).toBe('🇨🇳')
  })

  it('handles lowercase input', () => {
    expect(regionToFlag('us')).toBe('🇺🇸')
    expect(regionToFlag('de')).toBe('🇩🇪')
  })
})

describe('uniqueLocaleValidator', () => {
  it('returns true for undefined', () => {
    expect(uniqueLocaleValidator(undefined)).toBe(true)
  })

  it('returns true for empty array', () => {
    expect(uniqueLocaleValidator([])).toBe(true)
  })

  it('returns true for unique locales', () => {
    const translations = [
      {locale: {_ref: 'locale-de-DE'}},
      {locale: {_ref: 'locale-fr-FR'}},
      {locale: {_ref: 'locale-ja-JP'}},
    ]
    expect(uniqueLocaleValidator(translations)).toBe(true)
  })

  it('returns error string for duplicate locales', () => {
    const translations = [
      {locale: {_ref: 'locale-de-DE'}},
      {locale: {_ref: 'locale-fr-FR'}},
      {locale: {_ref: 'locale-de-DE'}},
    ]
    expect(uniqueLocaleValidator(translations)).toBe('Each locale may only appear once')
  })

  it('handles entries with missing locale gracefully', () => {
    const translations = [{locale: {_ref: 'locale-de-DE'}}, {}, {locale: {_ref: 'locale-fr-FR'}}]
    expect(uniqueLocaleValidator(translations)).toBe(true)
  })
})

describe('prepareGlossaryEntry', () => {
  it('shows DNT suffix for do-not-translate terms', () => {
    const result = prepareGlossaryEntry({title: 'Sanity', status: 'approved', dnt: true})
    expect(result.title).toBe('Sanity [DNT]')
    expect(result.subtitle).toBe('Approved')
  })

  it('shows just the term for non-DNT entries', () => {
    const result = prepareGlossaryEntry({title: 'dataset', status: 'approved', dnt: false})
    expect(result.title).toBe('dataset')
    expect(result.subtitle).toBe('Approved')
  })

  it('shows fallback for missing status', () => {
    const result = prepareGlossaryEntry({title: 'Test', status: undefined, dnt: false})
    expect(result.subtitle).toBe('No status')
  })

  it('handles missing title', () => {
    const result = prepareGlossaryEntry({title: undefined, status: 'forbidden', dnt: false})
    expect(result.title).toBe('')
  })
})

describe('prepareGlossary', () => {
  it('shows entry count with plural', () => {
    const result = prepareGlossary({
      title: 'Medical Terms',
      subtitle: 'English (US)',
      entries: new Array(5),
    })
    expect(result.title).toBe('Medical Terms')
    expect(result.subtitle).toBe('English (US) - 5 terms')
  })

  it('shows singular for one entry', () => {
    const result = prepareGlossary({
      title: 'Brand Names',
      subtitle: 'English',
      entries: [{}],
    })
    expect(result.subtitle).toBe('English - 1 term')
  })

  it('handles undefined entries', () => {
    const result = prepareGlossary({
      title: 'Empty Glossary',
      subtitle: 'English',
      entries: undefined,
    })
    expect(result.subtitle).toBe('English - 0 terms')
  })
})
