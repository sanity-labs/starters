import {getPublishedId} from 'sanity'

/**
 * Create a translation.metadata reference entry.
 * v6 shape: explicit `language` field, `_key` auto-generated via `autoGenerateArrayKeys`.
 * Uses `_strengthenOnPublish` so the Content Lake auto-strengthens the reference
 * once the referenced document is published (translation.metadata is liveEdit).
 */
export function createReference(languageId: string, ref: string, type: string) {
  return {
    _type: 'internationalizedArrayReferenceValue',
    language: languageId,
    value: {
      _ref: getPublishedId(ref),
      _type: 'reference',
      _weak: true,
      _strengthenOnPublish: {type},
    },
  }
}
