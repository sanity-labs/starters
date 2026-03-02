import {useClient} from '@sanity/sdk-react'
import {useToast} from '@sanity/ui'
import {useCallback, useState} from 'react'
import {getPublishedId} from 'sanity'

import {useApp} from '../contexts/AppContext'
import {buildMetadataDocument} from '../lib/metadata'
import {DOC_LANGUAGE_QUERY} from '../queries/documentQueries'

type BulkSetDocumentLanguageParams = {
  availableLanguages: Array<{id: string; title: string}>
  documentIds: string[]
  documentType: string
  languageId: string
}

export const useBulkSetDocumentLanguage = () => {
  const {sanityClientConfig} = useApp()
  const client = useClient(sanityClientConfig)

  const toast = useToast()
  const [isBulkSettingLanguage, setIsBulkSettingLanguage] = useState(false)
  const [bulkLanguageProgress, setBulkLanguageProgress] = useState<{
    current: number
    currentDocId?: string
    total: number
  } | null>(null)

  const bulkSetDocumentLanguage = useCallback(
    async ({
      availableLanguages,
      documentIds,
      documentType,
      languageId,
    }: BulkSetDocumentLanguageParams): Promise<void> => {
      if (!documentIds.length || !languageId) {
        throw new Error('Missing required parameters')
      }

      const language = availableLanguages.find((lang) => lang.id === languageId)
      if (!language) {
        throw new Error(`Language ${languageId} not found in available languages`)
      }

      console.log('🌍 Bulk setting document language:', {
        documentCount: documentIds.length,
        language: language.title,
        languageId,
      })

      setIsBulkSettingLanguage(true)
      setBulkLanguageProgress({current: 0, total: documentIds.length})

      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      try {
        for (let i = 0; i < documentIds.length; i++) {
          const docId = documentIds[i]

          setBulkLanguageProgress({
            current: i + 1,
            currentDocId: docId,
            total: documentIds.length,
          })

          try {
            // 1. Check if document already has language set
            const existingDoc = await client.fetch(DOC_LANGUAGE_QUERY, {docId})

            if (existingDoc?.language) {
              console.log(`⏭️  Skipping ${docId} - already has language: ${existingDoc.language}`)
              continue
            }

            // 2. Set the language field on the document
            await client.patch(docId).set({language: languageId}).commit()

            // 3. Create the metadata document
            const metadataDocument = buildMetadataDocument(docId, languageId, documentType)

            // 4. Create metadata document
            await client.create(metadataDocument)

            await client.action({
              actionType: 'sanity.action.document.publish',
              draftId: docId,
              publishedId: getPublishedId(docId),
            })

            successCount++
            console.log(`✅ Set language for document ${i + 1}/${documentIds.length}: ${docId}`)
          } catch (error) {
            errorCount++
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            errors.push(`${docId}: ${errorMsg}`)
            console.error(`❌ Failed to set language for ${docId}:`, error)
          }
        }

        // Final results
        const message =
          errorCount === 0
            ? `Successfully set language to ${language.title} for ${successCount} documents`
            : `Completed with ${successCount} successes and ${errorCount} errors`

        toast.push({
          description: message,
          status: errorCount === 0 ? 'success' : 'warning',
          title: `Bulk Language Setting Complete`,
        })

        if (errors.length > 0) {
          console.warn('Bulk language setting errors:', errors)
        }
      } catch (error) {
        console.error('❌ Bulk language setting failed:', error)

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        toast.push({
          description: errorMessage,
          status: 'error',
          title: `Failed to bulk set document language`,
        })

        throw error
      } finally {
        setIsBulkSettingLanguage(false)
        setBulkLanguageProgress(null)
      }
    },
    [client, toast],
  )

  return {
    bulkLanguageProgress,
    bulkSetDocumentLanguage,
    isBulkSettingLanguage,
  }
}
