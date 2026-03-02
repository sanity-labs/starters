/**
 * Executes a single-locale translation: calls the translate agent,
 * post-processes the result, creates the document (draft or version),
 * updates metadata + workflow state, and returns the result.
 */

import type {SanityClient} from 'sanity'

import {getPublishedId} from 'sanity'

import type {LanguageData} from '../contexts/TranslationConfigContext'
import type {LanguageStatus} from '../contexts/TranslationStatusContext'

import {awaitAgentResult} from './awaitAgentResult'
import {type MetadataDoc, patchMetadataTranslation, writeWorkflowState} from './metadataOperations'
import {postProcessTranslation} from './postTranslationProcessing'

export interface TranslationExecutionResult {
  documentId: string
  documentTitle?: string
  releaseName?: string
}

interface TranslateAgentFn {
  (options: Record<string, unknown>): {
    subscribe: (observer: {
      complete?: () => void
      error?: (e: unknown) => void
      next?: (v: unknown) => void
    }) => {unsubscribe(): void} | void
  }
}

interface TranslationExecutionParams {
  baseDocumentId: string
  baseLanguage: string
  buildParams: (localeId: string) => {protectedPhrases: string[]; styleGuide: string}
  client: SanityClient
  currentUserId?: string
  documentType: string
  language: LanguageData
  languageField: string
  metadataDoc: MetadataDoc
  metadataId?: string
  selectedRelease: null | string
  signal: AbortSignal
  translate: TranslateAgentFn
  updateLocaleStatus: (
    metadataId: string,
    localeId: string,
    status: Partial<LanguageStatus>,
  ) => void
}

/**
 * Run the full single-locale translation pipeline:
 * 1. Call translate agent (noWrite)
 * 2. Post-process (slug, images)
 * 3. Create document (draft or version)
 * 4. Update metadata + workflow state
 * 5. Update left-side cache
 */
export async function executeTranslation({
  baseDocumentId,
  baseLanguage,
  buildParams,
  client,
  currentUserId,
  documentType,
  language,
  languageField,
  metadataDoc,
  metadataId,
  selectedRelease,
  signal,
  translate,
  updateLocaleStatus,
}: TranslationExecutionParams): Promise<null | TranslationExecutionResult> {
  const targetRelease = language.releaseId || selectedRelease
  const createAsDraft = !targetRelease

  const {protectedPhrases, styleGuide} = buildParams(language.id)

  const result = await awaitAgentResult(
    translate({
      documentId: baseDocumentId,
      fromLanguage: {id: baseLanguage, title: baseLanguage},
      languageFieldPath: languageField,
      noWrite: true,
      protectedPhrases,
      schemaId: '_.schemas.default',
      styleGuide,
      targetDocument: {operation: 'create'},
      toLanguage: {id: language.id, title: language.title},
    }),
    signal,
  )

  if (!result) return null

  const publishedId = getPublishedId((result as any)._id)

  const processedResult = await postProcessTranslation({
    baseDocumentId,
    baseLanguage,
    client,
    documentType,
    targetLocaleId: language.id,
    translatedResult: result as Record<string, unknown>,
  })

  let finalDocId: string
  let releaseName: string | undefined

  if (createAsDraft) {
    const draftId = `drafts.${publishedId}`
    await client.createOrReplace({
      ...processedResult,
      _id: draftId,
      _type: documentType,
      createdBy: currentUserId,
      language: language.id,
    })
    finalDocId = draftId

    if (metadataId) {
      updateLocaleStatus(metadataId, language.id, {
        draftExists: true,
        publishedExists: false,
        ref: publishedId,
        status: 'draft',
      })
    }
  } else {
    const versionId = `versions.${targetRelease}.${publishedId}`
    await client.action({
      actionType: 'sanity.action.document.version.create',
      document: {
        ...processedResult,
        _id: versionId,
        _type: documentType,
        createdBy: currentUserId,
        language: language.id,
      },
      publishedId,
    })
    finalDocId = versionId

    if (metadataId && targetRelease) {
      updateLocaleStatus(metadataId, language.id, {
        draftExists: false,
        publishedExists: false,
        ref: publishedId,
        status: 'inRelease',
        versionReleaseIds: [targetRelease],
      })
    }

    try {
      const releaseDoc = await client.fetch<{metadata?: {title?: string}; name?: string}>(
        `*[_id == $releaseId][0]{ name, metadata }`,
        {releaseId: `_.releases.${targetRelease}`},
      )
      releaseName = releaseDoc?.metadata?.title || releaseDoc?.name || targetRelease
    } catch (err) {
      console.warn('Could not fetch release name:', err)
    }
  }

  await patchMetadataTranslation(
    client,
    metadataDoc,
    baseLanguage,
    baseDocumentId,
    language.id,
    publishedId,
    documentType,
  )
  await writeWorkflowState(client, metadataDoc._id, language.id)

  return {
    documentId: finalDocId,
    documentTitle: processedResult.title as string | undefined,
    releaseName,
  }
}
