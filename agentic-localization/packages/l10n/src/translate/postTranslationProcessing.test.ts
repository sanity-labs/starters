import {describe, expect, it, vi} from 'vitest'

import {postProcessTranslation} from './postTranslationProcessing'

const BASE_DOC = {
  _id: 'article-1',
  _type: 'article',
  cover: {_type: 'image', crop: {_type: 'sanity.imageCrop', top: 0.1}},
}

function reader(baseDoc: unknown = BASE_DOC) {
  return {fetch: vi.fn().mockResolvedValue(baseDoc)}
}

describe('postProcessTranslation', () => {
  it('generates a localized slug and drops the source audio summary', async () => {
    const result = await postProcessTranslation({
      baseDocumentId: 'article-1',
      baseLanguage: 'en-US',
      client: reader(),
      documentType: 'article',
      targetLocaleId: 'de-DE',
      translatedResult: {title: 'Der Start', audioSummary: {_type: 'file'}},
    })

    expect(result.slug).toEqual({current: 'der-start', fullUrl: '/de-de/der-start'})
    expect(result).not.toHaveProperty('audioSummary')
  })

  it('leaves the slug alone when translating into the source language', async () => {
    const result = await postProcessTranslation({
      baseDocumentId: 'article-1',
      baseLanguage: 'en-US',
      client: reader(),
      documentType: 'article',
      targetLocaleId: 'en-US',
      translatedResult: {title: 'The launch'},
    })

    expect(result.slug).toBeUndefined()
  })

  it('keeps a non-article type audio summary', async () => {
    const result = await postProcessTranslation({
      baseDocumentId: 'person-1',
      baseLanguage: 'en-US',
      client: reader(),
      documentType: 'person',
      targetLocaleId: 'de-DE',
      translatedResult: {title: 'Name', audioSummary: {_type: 'file'}},
    })

    expect(result).toHaveProperty('audioSummary')
  })

  it('restores image crop from the base document', async () => {
    const result = await postProcessTranslation({
      baseDocumentId: 'article-1',
      baseLanguage: 'en-US',
      client: reader(),
      documentType: 'article',
      targetLocaleId: 'de-DE',
      translatedResult: {title: 'Der Start', cover: {_type: 'image'}},
    })

    expect(result.cover).toEqual(BASE_DOC.cover)
  })

  it('survives a missing base document', async () => {
    const result = await postProcessTranslation({
      baseDocumentId: 'gone',
      baseLanguage: 'en-US',
      client: reader(null),
      documentType: 'article',
      targetLocaleId: 'de-DE',
      translatedResult: {title: 'Der Start'},
    })

    expect(result.title).toBe('Der Start')
  })
})
