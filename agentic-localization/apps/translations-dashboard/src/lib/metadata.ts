import {getPublishedId} from 'sanity'

import {getTranslationMetadataId} from '@starter/l10n/core/ids'

import {createReference} from './createReference'

/** Shape accepted by `client.createIfNotExists()` for metadata documents. */
type NewTranslationMetadata = {
  _id: string
  _type: 'translation.metadata'
  schemaTypes: string[]
  translations: ReturnType<typeof createReference>[]
}

/**
 * Build a complete translation metadata document for a source document.
 * Uses a deterministic ID based on the source document's published ID.
 */
export function buildMetadataDocument(
  documentId: string,
  languageKey: string,
  schemaType: string,
): NewTranslationMetadata {
  return {
    _id: getTranslationMetadataId(documentId),
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
): ReturnType<typeof createReference> {
  return createReference(languageKey, getPublishedId(documentId), 'document')
}

export {METADATA_EXISTS_QUERY} from '../queries/metadataQueries'
