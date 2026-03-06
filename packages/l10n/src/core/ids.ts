/**
 * Deterministic ID helpers for translation metadata documents.
 *
 * translation.metadata docs are keyed by their source document's published ID,
 * eliminating race-condition duplicates from concurrent `client.create()` calls.
 *
 * Uses `@sanity/id-utils` (lightweight leaf package) instead of `sanity`
 * so the core module stays free of the full Studio bundle.
 */

import {type DocumentId, getPublishedId} from '@sanity/id-utils'

const METADATA_PREFIX = 'translation.metadata'

/**
 * Compute the deterministic `_id` for a `translation.metadata` document.
 *
 * Given any form of a source document ID (published, draft, or version),
 * returns `translation.metadata.<publishedId>`.
 *
 * @example
 * getTranslationMetadataId('article-123')         // 'translation.metadata.article-123'
 * getTranslationMetadataId('drafts.article-123')   // 'translation.metadata.article-123'
 * getTranslationMetadataId('versions.r1.article-123') // 'translation.metadata.article-123'
 */
export function getTranslationMetadataId(sourceDocumentId: string): string {
  return `${METADATA_PREFIX}.${getPublishedId(sourceDocumentId as DocumentId)}`
}
