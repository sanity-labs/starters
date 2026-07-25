import {isRecord} from '../core/isRecord'
import {generateLocalizedSlug} from './generateLocalizedSlug'
import {restoreImageCropHotspot} from './imageUtils'

/**
 * The single read this module needs. Structural rather than `SanityClient` so
 * both a Studio client and the workflow engine's effect client satisfy it.
 */
export interface SourceDocumentReader {
  fetch: <T>(
    query: string,
    params?: Record<string, unknown>,
    options?: {tag?: string},
  ) => Promise<T>
}

interface PostProcessOptions {
  baseDocumentId: string
  baseLanguage: string
  client: SourceDocumentReader
  documentType: string
  targetLocaleId: string
  translatedResult: Record<string, unknown>
}

export async function postProcessTranslation({
  baseDocumentId,
  baseLanguage,
  client,
  documentType,
  targetLocaleId,
  translatedResult,
}: PostProcessOptions): Promise<Record<string, unknown>> {
  const processedResult = {...translatedResult}

  if (typeof processedResult.title === 'string' && targetLocaleId !== baseLanguage) {
    processedResult.slug = generateLocalizedSlug(processedResult.title, targetLocaleId)

    if (documentType === 'article') {
      delete processedResult.audioSummary
    }
  }

  const baseDoc = await client.fetch<unknown>(
    `*[_id == $id][0]`,
    {id: baseDocumentId},
    {tag: 'restore-images'},
  )
  const restored = restoreImageCropHotspot(baseDoc, processedResult)

  return isRecord(restored) ? restored : processedResult
}
