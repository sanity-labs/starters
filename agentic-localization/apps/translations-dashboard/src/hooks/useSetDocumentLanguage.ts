import {useClient} from '@sanity/sdk-react'
import {useToast} from '@sanity/ui'
import {useCallback, useState} from 'react'
import {getPublishedId, type SanityDocument} from 'sanity'

import {buildMetadataDocument} from '../lib/metadata'

type SetDocumentLanguageParams = {
  availableLanguages: Array<{id: string; title: string}>
  documentId: string
  documentType: string
  languageId: string
  sourceDocument: SanityDocument
}

export const useSetDocumentLanguage = () => {
  const client = useClient({apiVersion: '2025-05-01'})

  const toast = useToast()
  const [isSettingLanguage, setIsSettingLanguage] = useState(false)

  const setDocumentLanguage = useCallback(
    async ({
      availableLanguages,
      documentId: docId,
      documentType,
      languageId,
      sourceDocument,
    }: SetDocumentLanguageParams): Promise<void> => {
      if (!docId || !languageId || !sourceDocument) {
        throw new Error('Missing required parameters')
      }

      const language = availableLanguages.find((lang) => lang.id === languageId)
      if (!language) {
        throw new Error(`Language ${languageId} not found in available languages`)
      }

      console.log('🌍 Setting document language:', {
        documentId: docId,
        language: language.title,
        languageId,
      })
      setIsSettingLanguage(true)

      try {
        // 1. Set the language field on the source document using client.patch
        // Note: We'll use client.patch for now since useEditDocument requires component-level usage
        await client.patch(docId).set({language: languageId}).commit({tag: 'assign-language'})

        // 2. Create the metadata document
        const metadataDocument = buildMetadataDocument(docId, languageId, documentType)

        // 3. Create metadata document using client.create
        await client.create(metadataDocument, {tag: 'init-translation'})

        console.log('✅ Document language set successfully')

        await client.action(
          {
            actionType: 'sanity.action.document.publish',
            draftId: docId,
            publishedId: getPublishedId(docId),
          },
          {tag: 'publish-language'},
        )

        toast.push({
          description: 'Created translation metadata',
          status: 'success',
          title: `Set document language to ${language.title}`,
        })
      } catch (error) {
        console.error('❌ Failed to set document language:', error)

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        toast.push({
          description: errorMessage,
          status: 'error',
          title: `Failed to set document language to ${language.title}`,
        })

        throw error
      } finally {
        setIsSettingLanguage(false)
      }
    },
    [client, toast],
  )

  return {
    isSettingLanguage,
    setDocumentLanguage,
  }
}
