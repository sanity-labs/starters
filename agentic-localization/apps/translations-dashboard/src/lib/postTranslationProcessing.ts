/**
 * Shared post-processing for translated documents: slug generation,
 * field cleanup, and image crop/hotspot restoration.
 */

import type {SanityClient} from 'sanity'

import {generateLocalizedSlug} from '../helpers/generateLocalizedSlug'

import {restoreImageCropHotspot} from './imageUtils'

interface PostProcessOptions {
  baseDocumentId: string
  baseLanguage: string
  client: SanityClient
  documentType: string
  targetLocaleId: string
  translatedResult: Record<string, unknown>
}

/**
 * Apply slug generation, field cleanup, and image crop/hotspot restoration
 * to a freshly translated document result. Returns the processed result.
 */
export async function postProcessTranslation({
  baseDocumentId,
  baseLanguage,
  client,
  documentType,
  targetLocaleId,
  translatedResult,
}: PostProcessOptions): Promise<Record<string, unknown>> {
  let processedResult = {...translatedResult}

  if (processedResult?.title && targetLocaleId !== baseLanguage) {
    const newSlug = generateLocalizedSlug(processedResult.title as string, targetLocaleId)

    processedResult.slug = newSlug

    if (documentType === 'article') {
      delete processedResult.audioSummary
    }
  }

  const baseDoc = await client.fetch(`*[_id == $id][0]`, {id: baseDocumentId})
  processedResult = restoreImageCropHotspot(baseDoc, processedResult) as typeof processedResult

  return processedResult
}
