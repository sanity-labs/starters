import {describe, expect, it} from 'vitest'

import {listTranslations, resolveFallbackChain} from './locales'
import type {Locale} from './types'

const locale = (code: string, fallback: string | null = null): Locale => ({
  code,
  title: code,
  nativeName: null,
  fallback,
})

describe('resolveFallbackChain', () => {
  it('walks every hop the locale documents configure', () => {
    const locales = [locale('pt-BR', 'pt-PT'), locale('pt-PT', 'en-US'), locale('en-US')]

    expect(resolveFallbackChain('pt-BR', locales)).toEqual(['pt-PT', 'en-US'])
  })

  it('ends at the default language even with no fallback configured', () => {
    expect(resolveFallbackChain('de-DE', [locale('de-DE')])).toEqual(['en-US'])
  })

  it('does not append the default language twice', () => {
    const locales = [locale('de-DE', 'en-US'), locale('en-US')]

    expect(resolveFallbackChain('de-DE', locales)).toEqual(['en-US'])
  })

  it('stops on a cycle instead of looping', () => {
    const locales = [locale('de-DE', 'fr-FR'), locale('fr-FR', 'de-DE')]

    expect(resolveFallbackChain('de-DE', locales)).toEqual(['fr-FR', 'en-US'])
  })

  it('is empty for the default language itself', () => {
    expect(resolveFallbackChain('en-US', [locale('en-US')])).toEqual([])
  })

  it('treats an unknown locale as having only the default', () => {
    expect(resolveFallbackChain('is-IS', [])).toEqual(['en-US'])
  })
})

describe('listTranslations', () => {
  it('includes the document itself', () => {
    const result = listTranslations({language: 'en-US', slug: 'hello', translations: null})

    expect(result).toEqual([{language: 'en-US', slug: 'hello'}])
  })

  it('carries each sibling under its own slug', () => {
    const result = listTranslations({
      language: 'en-US',
      slug: 'hello',
      translations: [
        {language: 'en-US', slug: 'hello'},
        {language: 'de-DE', slug: 'hallo'},
      ],
    })

    expect(result).toEqual([
      {language: 'en-US', slug: 'hello'},
      {language: 'de-DE', slug: 'hallo'},
    ])
  })

  it('keeps one entry per language', () => {
    const result = listTranslations({
      language: 'de-DE',
      slug: 'hallo',
      translations: [{language: 'de-DE', slug: 'hallo-neu'}],
    })

    expect(result).toEqual([{language: 'de-DE', slug: 'hallo-neu'}])
  })

  it('drops entries that cannot be linked to', () => {
    const result = listTranslations({
      language: 'en-US',
      slug: 'hello',
      translations: [null, {language: 'fr-FR', slug: null}, {language: null, slug: 'bonjour'}],
    })

    expect(result).toEqual([{language: 'en-US', slug: 'hello'}])
  })

  it('is empty for a document with neither a language nor a slug', () => {
    expect(listTranslations({language: null, slug: null, translations: null})).toEqual([])
  })
})
