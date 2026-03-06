/**
 * Shared operations for translation.metadata documents:
 * fetch-or-create, add translation reference, write workflow state.
 */

import type {SanityClient} from 'sanity'

import {getPublishedId} from 'sanity'

import {getTranslationMetadataId} from '@starter/l10n/core/ids'

import type {TranslationReference} from '../types'
import {METADATA_WITH_TRANSLATIONS_QUERY} from '../queries/metadataQueries'
import {createReference} from './createReference'

export type MetadataDoc = {
  _id: string
  translations: TranslationReference[] | null
}

/**
 * Fetch the metadata document for a base document, or create one if missing.
 * Uses `createIfNotExists` with a deterministic ID to prevent race-condition duplicates.
 */
export async function fetchOrCreateMetadata(
  client: SanityClient,
  baseDocumentId: string,
  baseLanguage: string,
  documentType: string,
): Promise<MetadataDoc> {
  const publishedId = getPublishedId(baseDocumentId)
  const fetched = await client.fetch<MetadataDoc | null>(METADATA_WITH_TRANSLATIONS_QUERY, {
    documentId: publishedId,
  })

  if (fetched) return fetched

  const sourceRef = createReference(baseLanguage, baseDocumentId, documentType)
  const metadataId = getTranslationMetadataId(publishedId)
  await client.createIfNotExists({
    _id: metadataId,
    _type: 'translation.metadata',
    schemaTypes: [documentType],
    translations: [sourceRef],
  })
  return {_id: metadataId, translations: [sourceRef]}
}

/**
 * Atomically add a translation reference to the metadata document.
 * Ensures the source language reference also exists.
 */
export async function patchMetadataTranslation(
  client: SanityClient,
  metadataDoc: MetadataDoc,
  baseLanguage: string,
  baseDocumentId: string,
  targetLocaleId: string,
  publishedId: string,
  documentType: string,
): Promise<void> {
  const sourceReference = createReference(baseLanguage, baseDocumentId, documentType)
  const translationReference = createReference(targetLocaleId, publishedId, documentType)

  const sourceExists = metadataDoc.translations?.some(
    (t: {_key: string}) => t._key === baseLanguage,
  )
  const translationExists = metadataDoc.translations?.some(
    (t: {_key: string}) => t._key === targetLocaleId,
  )

  let patch = client.patch(metadataDoc._id).setIfMissing({translations: []})

  if (!sourceExists) {
    patch = patch.insert('before', 'translations[0]', [sourceReference])
  }
  if (translationExists) {
    patch = patch.unset([`translations[_key=="${targetLocaleId}"]`])
  }
  patch = patch.append('translations', [translationReference])

  await patch.commit()
}

/**
 * Write the workflow state for a locale on the metadata document.
 */
export async function writeWorkflowState(
  client: SanityClient,
  metadataId: string,
  localeId: string,
  source: 'ai' | 'manual' = 'ai',
): Promise<void> {
  await client
    .patch(metadataId)
    .setIfMissing({workflowStates: []})
    .unset([`workflowStates[_key=="${localeId}"]`])
    .append('workflowStates', [
      {
        _key: localeId,
        source,
        status: 'needsReview',
        updatedAt: new Date().toISOString(),
      },
    ])
    .commit()
}
