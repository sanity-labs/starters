import {describe, expect, it} from 'vitest'
import {getFieldTranslationMetadataId} from './fieldMetadataIds'

describe('getFieldTranslationMetadataId', () => {
  it('produces deterministic ID from a published ID', () => {
    expect(getFieldTranslationMetadataId('person-123')).toBe(
      'fieldTranslation.metadata.person-123',
    )
  })

  it('strips drafts prefix before computing', () => {
    expect(getFieldTranslationMetadataId('drafts.person-123')).toBe(
      'fieldTranslation.metadata.person-123',
    )
  })

  it('strips versions prefix before computing', () => {
    expect(getFieldTranslationMetadataId('versions.r1.person-123')).toBe(
      'fieldTranslation.metadata.person-123',
    )
  })

  it('is idempotent across all ID forms', () => {
    const id1 = getFieldTranslationMetadataId('person-123')
    const id2 = getFieldTranslationMetadataId('drafts.person-123')
    const id3 = getFieldTranslationMetadataId('versions.r1.person-123')
    expect(id1).toBe(id2)
    expect(id2).toBe(id3)
  })
})
