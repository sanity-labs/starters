import {describe, expect, it} from 'vitest'
import {getReviewProgress, getValidAnalysis, isAnalysisFresh} from './staleAnalysisCache'
import type {StaleAnalysisCache} from './types'

const makeCache = (overrides?: Partial<StaleAnalysisCache>): StaleAnalysisCache => ({
  sourceRevision: 'rev-abc',
  analyzedAt: new Date().toISOString(),
  result: {
    explanation: 'Minor wording changes',
    materiality: 'cosmetic',
    suggestions: [],
  },
  preTranslations: [],
  ...overrides,
})

describe('getValidAnalysis', () => {
  it('returns cache when sourceRevision matches', () => {
    const cache = makeCache({sourceRevision: 'rev-abc'})
    expect(getValidAnalysis(cache, 'rev-abc')).toBe(cache)
  })

  it('returns null when sourceRevision mismatches', () => {
    const cache = makeCache({sourceRevision: 'rev-abc'})
    expect(getValidAnalysis(cache, 'rev-xyz')).toBeNull()
  })

  it('returns null for null/undefined cache', () => {
    expect(getValidAnalysis(null, 'rev-abc')).toBeNull()
    expect(getValidAnalysis(undefined, 'rev-abc')).toBeNull()
  })
})

describe('isAnalysisFresh', () => {
  it('returns true within the 5-minute freshness window', () => {
    const cache = makeCache({
      sourceRevision: 'rev-abc',
      analyzedAt: new Date().toISOString(),
    })
    expect(isAnalysisFresh(cache, 'rev-abc')).toBe(true)
  })

  it('returns false outside the freshness window', () => {
    const staleTime = new Date(Date.now() - 6 * 60 * 1000).toISOString()
    const cache = makeCache({
      sourceRevision: 'rev-abc',
      analyzedAt: staleTime,
    })
    expect(isAnalysisFresh(cache, 'rev-abc')).toBe(false)
  })

  it('returns false when sourceRevision mismatches', () => {
    const cache = makeCache({sourceRevision: 'rev-abc'})
    expect(isAnalysisFresh(cache, 'rev-xyz')).toBe(false)
  })

  it('returns false for null cache', () => {
    expect(isAnalysisFresh(null, 'rev-abc')).toBe(false)
  })
})

describe('getReviewProgress', () => {
  it('returns fields for matching _key', () => {
    const fields = {title: 'applied' as const, body: 'skipped' as const}
    const cache = makeCache({
      sourceRevision: 'rev-abc',
      reviewProgress: [
        {_key: 'rev-abc--es-MX', sourceRevision: 'rev-abc', localeId: 'es-MX', fields},
      ],
    })
    expect(getReviewProgress(cache, 'rev-abc', 'es-MX')).toEqual(fields)
  })

  it('returns null for non-matching locale', () => {
    const cache = makeCache({
      sourceRevision: 'rev-abc',
      reviewProgress: [
        {
          _key: 'rev-abc--es-MX',
          sourceRevision: 'rev-abc',
          localeId: 'es-MX',
          fields: {title: 'applied'},
        },
      ],
    })
    expect(getReviewProgress(cache, 'rev-abc', 'de-DE')).toBeNull()
  })

  it('returns null when sourceRevision mismatches cache', () => {
    const cache = makeCache({
      sourceRevision: 'rev-abc',
      reviewProgress: [
        {
          _key: 'rev-abc--es-MX',
          sourceRevision: 'rev-abc',
          localeId: 'es-MX',
          fields: {title: 'applied'},
        },
      ],
    })
    expect(getReviewProgress(cache, 'rev-xyz', 'es-MX')).toBeNull()
  })

  it('returns null when reviewProgress is undefined', () => {
    const cache = makeCache({sourceRevision: 'rev-abc'})
    expect(getReviewProgress(cache, 'rev-abc', 'es-MX')).toBeNull()
  })
})
