import {describe, expect, it} from 'vitest'
import {getTranslationMetadataId} from './ids'

describe('getTranslationMetadataId', () => {
  it('produces deterministic ID from a published ID', () => {
    expect(getTranslationMetadataId('article-123')).toBe('translation.metadata.article-123')
  })

  it('strips drafts prefix before computing', () => {
    expect(getTranslationMetadataId('drafts.article-123')).toBe('translation.metadata.article-123')
  })

  it('strips versions prefix before computing', () => {
    expect(getTranslationMetadataId('versions.r1.article-123')).toBe(
      'translation.metadata.article-123',
    )
  })

  it('is idempotent across all ID forms', () => {
    const id1 = getTranslationMetadataId('article-123')
    const id2 = getTranslationMetadataId('drafts.article-123')
    const id3 = getTranslationMetadataId('versions.r1.article-123')
    expect(id1).toBe(id2)
    expect(id2).toBe(id3)
  })
})
