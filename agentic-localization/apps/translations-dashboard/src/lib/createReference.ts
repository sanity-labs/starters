import type {TranslationReference} from '@sanity/document-internationalization'
import {getPublishedId} from 'sanity'

/**
 * Create a translation.metadata reference entry.
 * `_key` is auto-generated via `autoGenerateArrayKeys` on `.commit()`.
 * `_strengthenOnPublish` auto-strengthens the weak ref once the referenced doc is published.
 */
export function createReference(
  languageId: string,
  ref: string,
  type: string,
): Omit<TranslationReference, '_key'> {
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
