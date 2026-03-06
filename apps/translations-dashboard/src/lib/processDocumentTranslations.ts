/**
 * Core logic for translating all missing locales of a single document.
 * Used by the batch translation hook. Processes locales concurrently
 * with a configurable concurrency limit and reports per-locale progress.
 */

import type {User} from 'sanity'
import type {SanityClient} from 'sanity'

import {getPublishedId} from 'sanity'

import type {LanguageStatus} from '../contexts/TranslationStatusContext'

import {MAX_CONCURRENT_TRANSLATIONS} from '../consts/translation'
import {awaitAgentResult} from './awaitAgentResult'
import {createReference} from './createReference'
import {fetchOrCreateMetadata, writeWorkflowState} from './metadataOperations'
import {postProcessTranslation} from './postTranslationProcessing'

type AvailableLanguage = {
  id: string
  releaseId?: string
  title: string
}

type TranslationProgressCallback = (
  documentId: string,
  progress: {
    currentlyTranslating?: string
    translations: Array<{
      languageId: string
      languageTitle: string
      status: 'created' | 'creating' | 'failed' | 'pending'
      translatedDocumentId?: string
    }>
  },
) => void

export async function processDocumentTranslationsWithProgress(
  baseDocumentId: string,
  documentType: string,
  baseLanguage: string,
  availableLanguages: AvailableLanguage[],
  client: SanityClient,
  onProgress: TranslationProgressCallback,
  selectedRelease: null | string,
  currentUser: null | User,
  updateLocaleStatus: (
    metadataId: string,
    localeId: string,
    status: Partial<LanguageStatus>,
  ) => void,
  translateFn: (options: Record<string, unknown>) => {
    subscribe: (observer: {
      complete?: () => void
      error?: (e: unknown) => void
      next?: (v: unknown) => void
    }) => {unsubscribe(): void} | void
  },
  buildParamsFn: (targetLocaleTag: string) => {protectedPhrases: string[]; styleGuide: string},
  languageField: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const metadataDoc = await fetchOrCreateMetadata(
      client,
      baseDocumentId,
      baseLanguage,
      documentType,
    )

    if (!metadataDoc.translations) {
      metadataDoc.translations = []
    }

    const existingLanguageKeys = metadataDoc.translations.map(
      (translation: {_key: string}) => translation._key,
    )
    const missingLocales = availableLanguages.filter(
      (locale) => !existingLanguageKeys.includes(locale.id),
    )

    if (missingLocales.length === 0) {
      return true
    }

    const progressState: Record<
      string,
      {
        releaseName?: string
        status: 'created' | 'creating' | 'failed' | 'pending'
        translatedDocumentId?: string
      }
    > = {}
    missingLocales.forEach((locale) => {
      progressState[locale.id] = {status: 'pending'}
    })

    const emitProgress = () => {
      onProgress(baseDocumentId, {
        translations: missingLocales.map((locale) => ({
          languageId: locale.id,
          languageTitle: locale.title,
          ...progressState[locale.id],
        })),
      })
    }

    emitProgress()

    const validLocales = missingLocales.filter((locale) => locale.id && locale.title)

    // Ensure source reference exists before concurrent translations
    const sourceExists = metadataDoc.translations?.some(
      (t: {_key: string}) => t._key === baseLanguage,
    )
    if (!sourceExists) {
      const sourceReference = createReference(baseLanguage, baseDocumentId, documentType)
      await client
        .patch(metadataDoc._id)
        .setIfMissing({translations: []})
        .insert('before', 'translations[0]', [sourceReference])
        .commit()
    }

    await processWithConcurrencyLimit(
      validLocales,
      async (locale) => {
        try {
          progressState[locale.id] = {status: 'creating'}
          emitProgress()

          const targetRelease = locale.releaseId || selectedRelease
          const createAsDraft = !targetRelease

          const {protectedPhrases, styleGuide} = buildParamsFn(locale.id)

          const result = await awaitAgentResult(
            translateFn({
              documentId: baseDocumentId,
              fromLanguage: {id: baseLanguage, title: baseLanguage},
              languageFieldPath: languageField,
              noWrite: true,
              protectedPhrases,
              schemaId: '_.schemas.default',
              styleGuide,
              targetDocument: {operation: 'create'},
              toLanguage: {id: locale.id, title: locale.title},
            }),
            signal,
          )

          if (result) {
            const publishedId = getPublishedId((result as any)._id)

            const processedResult = await postProcessTranslation({
              baseDocumentId,
              baseLanguage,
              client,
              documentType,
              targetLocaleId: locale.id,
              translatedResult: result as Record<string, unknown>,
            })

            let finalDocId: string
            let releaseName: null | string = null

            if (createAsDraft) {
              const draftId = `drafts.${publishedId}`
              await client.createOrReplace({
                ...processedResult,
                _id: draftId,
                _type: documentType,
                createdBy: currentUser?.id,
                language: locale.id,
              })
              finalDocId = draftId
            } else {
              const versionId = `versions.${targetRelease}.${publishedId}`
              await client.action({
                actionType: 'sanity.action.document.version.create',
                document: {
                  ...processedResult,
                  _id: versionId,
                  _type: documentType,
                  createdBy: currentUser?.id,
                  language: locale.id,
                },
                publishedId: publishedId,
              })
              finalDocId = versionId

              try {
                const releaseDoc = await client.fetch<{metadata?: {title?: string}; name?: string}>(
                  `*[_id == $releaseId][0]{ name, metadata }`,
                  {releaseId: `_.releases.${targetRelease}`},
                )
                releaseName = releaseDoc?.metadata?.title || releaseDoc?.name || targetRelease
              } catch (err) {
                console.warn('Could not fetch release name:', err)
                releaseName = targetRelease
              }
            }

            // Update metadata with translation reference
            const translationReference = createReference(locale.id, publishedId, documentType)
            const translationExists = metadataDoc.translations?.some(
              (t: {_key: string}) => t._key === locale.id,
            )

            let patch = client.patch(metadataDoc._id).setIfMissing({translations: []})
            if (translationExists) {
              patch = patch.unset([`translations[_key=="${locale.id}"]`])
            }
            patch = patch.append('translations', [translationReference])
            await patch.commit()

            await writeWorkflowState(client, metadataDoc._id, locale.id)

            // Update the left side cache
            if (createAsDraft) {
              updateLocaleStatus(metadataDoc._id, locale.id, {
                draftExists: true,
                publishedExists: false,
                ref: publishedId,
                status: 'draft',
              })
            } else if (targetRelease) {
              updateLocaleStatus(metadataDoc._id, locale.id, {
                draftExists: false,
                publishedExists: false,
                ref: publishedId,
                status: 'inRelease',
                versionReleaseIds: [targetRelease],
              })
            }

            progressState[locale.id] = {
              releaseName: releaseName || undefined,
              status: 'created',
              translatedDocumentId: finalDocId,
            }
            emitProgress()
          }
        } catch (error) {
          console.error(
            `Failed to create translation for ${locale.title} (${locale.id}) on document ${baseDocumentId}:`,
            error,
          )

          progressState[locale.id] = {status: 'failed'}
          emitProgress()
        }
      },
      MAX_CONCURRENT_TRANSLATIONS,
    )

    const failedCount = Object.values(progressState).filter((p) => p.status === 'failed').length
    return failedCount === 0
  } catch (error) {
    console.error(`Failed to process document ${baseDocumentId}:`, error)
    return false
  }
}

async function processWithConcurrencyLimit<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  limit: number,
): Promise<void> {
  const executing: Set<Promise<void>> = new Set()

  for (const item of items) {
    const promise = processor(item).finally(() => {
      executing.delete(promise)
    })
    executing.add(promise)

    if (executing.size >= limit) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)
}
