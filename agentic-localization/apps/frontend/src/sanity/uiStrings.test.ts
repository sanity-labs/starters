import {describe, expect, it} from 'vitest'

import type {Locale} from './types'
import {formatUiString, resolveUiStrings, UI_STRING_DEFAULTS} from './uiStrings'

const locale = (code: string, fallback: string | null = null): Locale => ({
  code,
  title: code,
  nativeName: null,
  fallback,
})

const LOCALES = [locale('pt-BR', 'pt-PT'), locale('pt-PT', 'en-US'), locale('en-US')]

const entry = (language: string, value: string) => ({language, value})

describe('resolveUiStrings', () => {
  it('falls back to the built-in copy when the singleton has not been seeded', () => {
    expect(resolveUiStrings(null, 'de-DE', LOCALES)).toEqual(UI_STRING_DEFAULTS)
  })

  it('prefers the requested locale', () => {
    const strings = resolveUiStrings(
      {siteTitle: [entry('en-US', 'L10n Starter'), entry('pt-BR', 'Início L10n')]},
      'pt-BR',
      LOCALES,
    )

    expect(strings.siteTitle).toBe('Início L10n')
  })

  it('walks the locale fallback chain hop by hop', () => {
    const strings = resolveUiStrings(
      {siteTitle: [entry('en-US', 'English'), entry('pt-PT', 'Português')]},
      'pt-BR',
      LOCALES,
    )

    expect(strings.siteTitle).toBe('Português')
  })

  it('resolves each string on its own, not the document as a whole', () => {
    const strings = resolveUiStrings(
      {
        siteTitle: [entry('en-US', 'English'), entry('pt-BR', 'Brasileiro')],
        articlesHeading: [entry('en-US', 'Articles')],
      },
      'pt-BR',
      LOCALES,
    )

    expect(strings.siteTitle).toBe('Brasileiro')
    expect(strings.articlesHeading).toBe('Articles')
  })

  it('treats an empty entry as untranslated', () => {
    const strings = resolveUiStrings(
      {siteTitle: [entry('pt-BR', ''), entry('en-US', 'English')]},
      'pt-BR',
      LOCALES,
    )

    expect(strings.siteTitle).toBe('English')
  })

  it('keeps the default for a string the singleton does not carry', () => {
    const strings = resolveUiStrings({siteTitle: [entry('en-US', 'Renamed')]}, 'en-US', LOCALES)

    expect(strings.siteTitle).toBe('Renamed')
    expect(strings.backToArticles).toBe(UI_STRING_DEFAULTS.backToArticles)
  })
})

describe('formatUiString', () => {
  it('fills the tokens a notice declares', () => {
    expect(
      formatUiString('No {locale}, showing {fallback}.', {locale: 'fr-FR', fallback: 'en-US'}),
    ).toBe('No fr-FR, showing en-US.')
  })

  it('leaves an unknown token alone rather than blanking it', () => {
    expect(formatUiString('{locale} and {other}', {locale: 'de-DE'})).toBe('de-DE and {other}')
  })
})
