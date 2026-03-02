import type {SanityDocument} from 'sanity'

import {useClient, useCurrentUser} from '@sanity/sdk-react'
import {useAgentTranslate} from '@sanity/sdk-react'
import {useCallback, useEffect, useRef} from 'react'

import type {EnhancedDocument} from '../components/BatchTranslationPanel/types'
import {useTranslationConfig} from '../contexts/TranslationConfigContext'
import {useTranslationProgress} from '../contexts/TranslationProgressContext'
import {useTranslationStatusContext} from '../contexts/TranslationStatusContext'
import {enrichDocumentWithTranslationStatus} from '../helpers/translationStatus'
import {isAbortError} from '../lib/awaitAgentResult'
import {processDocumentTranslationsWithProgress} from '../lib/processDocumentTranslations'
import {BATCH_VALIDATE_DOCUMENTS_QUERY} from '../queries/documentQueries'
import {useTranslationParams} from './useTranslationParams'

type AvailableLanguage = {
  id: string
  releaseId?: string
  title: string
}

type BatchTranslationDoc = {
  _type: string
  language: null | string
} & SanityDocument

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

export const useBatchTranslationsWithProgress = () => {
  const {sanityClientConfig, translationsConfig} = useTranslationConfig()
  const {
    batchTranslationStatus,
    isBatchTranslating,
    setBatchTranslationStatus,
    setIsBatchTranslating,
  } = useTranslationProgress()
  const client = useClient(sanityClientConfig)
  const currentUser = useCurrentUser()
  const {updateLocaleStatus} = useTranslationStatusContext()
  const translate = useAgentTranslate()
  const {buildParams} = useTranslationParams()
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const validateSelectedDocuments = useCallback(
    async (
      documentIds: string[],
      availableLanguages: AvailableLanguage[],
      selectedRelease: null | string,
      releaseMap: Map<string, string>,
    ): Promise<{
      fullyTranslatedDocuments: EnhancedDocument[]
      invalidDocuments: EnhancedDocument[]
      validDocuments: EnhancedDocument[]
    }> => {
      if (!documentIds.length) {
        return {fullyTranslatedDocuments: [], invalidDocuments: [], validDocuments: []}
      }

      const documents = await client.fetch<
        Array<{
          _id: string
          _type: string
          title: string | null
          language: string | null
          hasMetadata: boolean
          _translationStatus: 'fully translated' | 'none' | 'partial'
        }>
      >(BATCH_VALIDATE_DOCUMENTS_QUERY, {documentIds})

      const invalidDocuments = documents.filter((doc) => !doc.language || !doc.hasMetadata)

      const fullyTranslatedDocuments = documents.filter(
        (doc) => doc.language && doc.hasMetadata && doc._translationStatus === 'fully translated',
      )

      const validDocuments = documents.filter(
        (doc) => doc.language && doc.hasMetadata && doc._translationStatus !== 'fully translated',
      )

      const enriched = await Promise.all([
        ...invalidDocuments.map((doc) =>
          enrichDocumentWithTranslationStatus(
            client,
            doc as EnhancedDocument,
            availableLanguages,
            selectedRelease,
            releaseMap,
            undefined,
          ),
        ),
        ...fullyTranslatedDocuments.map((doc) =>
          enrichDocumentWithTranslationStatus(
            client,
            doc as EnhancedDocument,
            availableLanguages,
            selectedRelease,
            releaseMap,
            undefined,
          ),
        ),
        ...validDocuments.map((doc) =>
          enrichDocumentWithTranslationStatus(
            client,
            doc as EnhancedDocument,
            availableLanguages,
            selectedRelease,
            releaseMap,
            undefined,
          ),
        ),
      ])

      const invalidCount = invalidDocuments.length
      const fullyTranslatedCount = fullyTranslatedDocuments.length

      return {
        fullyTranslatedDocuments: enriched.slice(invalidCount, invalidCount + fullyTranslatedCount),
        invalidDocuments: enriched.slice(0, invalidCount),
        validDocuments: enriched.slice(invalidCount + fullyTranslatedCount),
      }
    },
    [client],
  )

  const batchTranslateDocumentsWithProgress = useCallback(
    async (
      documentIds: string[],
      availableLanguages: AvailableLanguage[],
      onProgress: TranslationProgressCallback,
      selectedRelease: null | string,
    ): Promise<void> => {
      if (!documentIds.length) {
        setBatchTranslationStatus({message: 'No documents selected for translation'})
        return
      }

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsBatchTranslating(true)
      setBatchTranslationStatus({message: 'Starting batch translation...'})

      try {
        const tempReleaseMap = new Map<string, string>()
        const {fullyTranslatedDocuments, invalidDocuments, validDocuments} =
          await validateSelectedDocuments(
            documentIds,
            availableLanguages,
            selectedRelease,
            tempReleaseMap,
          )

        if (!validDocuments.length && !fullyTranslatedDocuments.length) {
          setIsBatchTranslating(false)
          setBatchTranslationStatus({
            message: 'No valid documents found for translation',
            success: false,
          })
          return
        }

        const statusMessages = []

        if (invalidDocuments.length > 0) {
          const invalidTitles = invalidDocuments.map((doc) => doc.title || 'Untitled').join(', ')
          statusMessages.push(
            `Skipping ${invalidDocuments.length} documents without language/metadata: ${invalidTitles}`,
          )
        }

        if (fullyTranslatedDocuments.length > 0) {
          const fullyTranslatedTitles = fullyTranslatedDocuments
            .map((doc) => doc.title || 'Untitled')
            .join(', ')
          statusMessages.push(
            `Skipping ${fullyTranslatedDocuments.length} fully translated documents: ${fullyTranslatedTitles}`,
          )
        }

        if (statusMessages.length > 0) {
          setBatchTranslationStatus({message: statusMessages.join('. ')})
        }

        if (!validDocuments.length) {
          setIsBatchTranslating(false)
          setBatchTranslationStatus({
            message:
              'No documents need translation. All selected documents are either fully translated or missing language configuration.',
            success: false,
          })
          return
        }

        let totalSuccessful = 0
        let totalFailed = 0

        for (let i = 0; i < validDocuments.length; i++) {
          if (controller.signal.aborted) break

          const document = validDocuments[i]

          setBatchTranslationStatus({
            message: `Processing document ${i + 1} of ${validDocuments.length}: ${document.title || 'Untitled'}...`,
          })

          try {
            if (!document.language) {
              totalFailed++
              continue
            }
            const success = await processDocumentTranslationsWithProgress(
              document._id,
              document._type,
              document.language,
              availableLanguages,
              client,
              onProgress,
              selectedRelease,
              currentUser,
              updateLocaleStatus,
              translate as unknown as Parameters<typeof processDocumentTranslationsWithProgress>[9],
              buildParams,
              translationsConfig.languageField,
              controller.signal,
            )
            if (success) {
              totalSuccessful++
            } else {
              totalFailed++
            }
          } catch (error) {
            console.error(`Failed to process document ${document._id}:`, error)
            totalFailed++
          }
        }

        setIsBatchTranslating(false)
        if (totalFailed === 0) {
          setBatchTranslationStatus({
            message: `Batch translation completed! ${totalSuccessful} documents processed successfully.`,
            success: true,
          })
        } else {
          setBatchTranslationStatus({
            message: `Batch translation completed with errors. ${totalSuccessful} successful, ${totalFailed} failed.`,
            success: false,
          })
        }
      } catch (error) {
        if (isAbortError(error)) {
          setIsBatchTranslating(false)
          setBatchTranslationStatus({message: 'Batch translation cancelled'})
          return
        }
        setIsBatchTranslating(false)
        setBatchTranslationStatus({
          message:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred during batch translation',
          success: false,
        })
        throw error
      }
    },
    [
      buildParams,
      client,
      currentUser,
      setIsBatchTranslating,
      setBatchTranslationStatus,
      translate,
      translationsConfig.languageField,
      validateSelectedDocuments,
      updateLocaleStatus,
    ],
  )

  const cancel = useCallback(() => abortRef.current?.abort(), [])

  return {
    batchTranslateDocumentsWithProgress,
    batchTranslationStatus,
    cancel,
    clearBatchStatus: () => setBatchTranslationStatus(null),
    isBatchTranslating,
    validateSelectedDocuments,
  }
}
