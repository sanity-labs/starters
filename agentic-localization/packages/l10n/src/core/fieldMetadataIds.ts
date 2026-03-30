/**
 * Deterministic ID helper for field-level translation metadata documents.
 *
 * Parallel to `ids.ts` for doc-level `translation.metadata`.
 * Uses the same pattern: `fieldTranslation.metadata.<publishedId>`.
 */

import {type DocumentId, getPublishedId} from '@sanity/id-utils'

const FIELD_METADATA_PREFIX = 'fieldTranslation.metadata'

/**
 * Compute the deterministic `_id` for a `fieldTranslation.metadata` document.
 *
 * @example
 * getFieldTranslationMetadataId('person-123')         // 'fieldTranslation.metadata.person-123'
 * getFieldTranslationMetadataId('drafts.person-123')   // 'fieldTranslation.metadata.person-123'
 */
export function getFieldTranslationMetadataId(sourceDocumentId: string): string {
  return `${FIELD_METADATA_PREFIX}.${getPublishedId(sourceDocumentId as DocumentId)}`
}
