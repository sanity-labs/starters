import {uuid} from '@sanity/uuid'
import {getPublishedId} from 'sanity'

import type {TranslationReference} from '../types'

/** Shape accepted by `client.create()` for new metadata documents. */
type NewTranslationMetadata = {
  _id: string
  _type: 'translation.metadata'
  schemaTypes: string[]
  translations: TranslationReference[]
}

/**
 * Build a complete translation metadata document for a source document.
 */
export function buildMetadataDocument(
  documentId: string,
  languageKey: string,
  schemaType: string,
): NewTranslationMetadata {
  return {
    _id: uuid(),
    _type: 'translation.metadata',
    schemaTypes: [schemaType],
    translations: [buildTranslationReference(documentId, languageKey)],
  }
}

/**
 * Build the reference entry for a single language in a translation metadata document.
 */
export function buildTranslationReference(
  documentId: string,
  languageKey: string,
): TranslationReference {
  return {
    _key: languageKey,
    _type: 'internationalizedArrayReferenceValue',
    value: {
      _ref: getPublishedId(documentId),
      _type: 'reference',
      _weak: true,
    },
  }
}

export {METADATA_EXISTS_QUERY} from '../queries/metadataQueries'
