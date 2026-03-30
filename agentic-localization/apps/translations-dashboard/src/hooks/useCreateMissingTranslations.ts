import type {MetadataDocument as TranslationMetadata} from '@sanity/document-internationalization'

import {DocumentId, getPublishedId} from '@sanity/id-utils'
import {useClient, useCurrentUser} from '@sanity/sdk-react'
import {useCallback} from 'react'

import {useApp} from '../contexts/AppContext'
import {generateLocalizedSlug} from '../helpers/generateLocalizedSlug'
import {createReference} from '../lib/createReference'
import {METADATA_WITH_TRANSLATIONS_QUERY} from '../queries/metadataQueries'

type AvailableLanguage = {
  id: string
  title: string
}

export const useCreateMissingTranslations = () => {
  const {
    creationStatus,
    isCreating,
    sanityClientConfig,
    setCreationStatus,
    setIsCreating,
    setTranslationDocumentId,
    translationDocumentId,
    translationsConfig,
  } = useApp()
  const client = useClient(sanityClientConfig)
  const currentUser = useCurrentUser()

  const createMissingTranslations = useCallback(
    async (
      baseDocumentId: DocumentId | undefined,
      baseLanguage: null | string | undefined,
      availableLanguages: AvailableLanguage[],
      documentType: string,
      targetReleaseId?: string,
    ): Promise<void> => {
      const translateClient = targetReleaseId
        ? client.withConfig({perspective: [targetReleaseId, 'drafts']})
        : client
      setTranslationDocumentId(baseDocumentId || null)
      setIsCreating(true)
      setCreationStatus({message: 'Starting to create translations...'})

      if (!baseDocumentId) {
        setIsCreating(false)
        setCreationStatus({message: 'Base document ID is required'})
        throw new Error('Base document ID is required')
      }

      if (!baseLanguage) {
        setIsCreating(false)
        setCreationStatus({message: 'Base language is required'})
        throw new Error('Base language is required')
      }

      try {
        const fetchedMetadata = await client.fetch<TranslationMetadata | null>(
          METADATA_WITH_TRANSLATIONS_QUERY,
          {documentId: getPublishedId(baseDocumentId)},
        )

        let metadataDoc = fetchedMetadata
        if (!metadataDoc) {
          const sourceRef = createReference(baseLanguage, baseDocumentId, documentType)
          const created = await client.create({
            _type: 'translation.metadata',
            schemaTypes: [documentType],
            translations: [sourceRef],
          })
          metadataDoc = {
            _id: created._id,
            translations: [sourceRef],
          } as unknown as TranslationMetadata
        }

        const existingLanguageKeys = metadataDoc.translations.map(
          (translation) => translation.language,
        )
        const missingLocales = availableLanguages.filter(
          (locale) => !existingLanguageKeys.includes(locale.id),
        )

        if (missingLocales.length === 0) {
          setIsCreating(false)
          setCreationStatus({message: 'No missing translations to create', success: true})
          setTranslationDocumentId(null)
          return
        }

        setCreationStatus({
          message: `Found ${missingLocales.length} missing translations to create`,
        })

        const createdTranslations: Array<{_key: string; value: {_ref: string; _type: string}}> = []

        for (let i = 0; i < missingLocales.length; i++) {
          const locale = missingLocales[i]

          setCreationStatus({
            message: `Creating translation ${i + 1} of ${missingLocales.length}: ${locale.title}`,
          })

          if (!locale.id || !locale.title) {
            continue
          }

          try {
            const result = await translateClient.agent.action.translate({
              documentId: baseDocumentId,
              fromLanguage: {id: baseLanguage, title: baseLanguage},
              languageFieldPath: translationsConfig.languageField,
              schemaId: '_.schemas.default',
              targetDocument: {operation: 'create'},
              toLanguage: {id: locale.id, title: locale.title},
            })

            if (result) {
              const transaction = client.transaction()

              const sourceReference = createReference(baseLanguage, baseDocumentId, documentType)

              const newTranslationReference = createReference(
                locale.id,
                getPublishedId(result._id as DocumentId),
                documentType,
              )

              // Generate localized slug for the translated document
              if (result?.title && locale.id !== baseLanguage) {
                const newSlug = generateLocalizedSlug(result.title, locale.id)

                const slugPatch = client.patch(result._id).set({
                  createdBy: currentUser?.id,
                  slug: newSlug,
                })

                transaction.patch(slugPatch)
              }

              // Patch translation to metadata document
              const metadataPatch = client
                .patch(metadataDoc._id)
                .setIfMissing({translations: [sourceReference]})
                .insert(`after`, `translations[-1]`, [newTranslationReference])
              transaction.patch(metadataPatch)

              await transaction.commit({autoGenerateArrayKeys: true})

              // Write workflow state after transaction
              await client
                .patch(metadataDoc._id)
                .setIfMissing({workflowStates: []})
                .unset([`workflowStates[language=="${locale.id}"]`])
                .append('workflowStates', [
                  {
                    language: locale.id,
                    source: 'ai',
                    status: 'needsReview',
                    updatedAt: new Date().toISOString(),
                  },
                ])
                .commit({autoGenerateArrayKeys: true})

              const publishedId = getPublishedId(result._id as DocumentId)

              await client.action({
                actionType: 'sanity.action.document.publish',
                draftId: result._id,
                publishedId: publishedId,
              })

              if (i === missingLocales.length - 1) {
                setIsCreating(false)
                setCreationStatus({
                  message: 'All translations created successfully!',
                  success: true,
                })
                setTranslationDocumentId(null)
              }
            }
          } catch (error) {
            let userMessage = `Failed to create translation for ${locale.title} (${locale.id})`

            if (error instanceof Error) {
              if (
                error.message.includes('Too Many Requests') ||
                error.message.includes('rate limit')
              ) {
                userMessage = `Rate limit reached for ${locale.title} translation. The AI service is temporarily busy. Please wait a few minutes and try again.`
              } else if (
                error.message.includes('network') ||
                error.message.includes('connection')
              ) {
                userMessage = `Network error while creating ${locale.title} translation. Please check your connection and try again.`
              } else if (error.message.includes('timeout')) {
                userMessage = `Request timed out for ${locale.title} translation. Please try again.`
              } else {
                userMessage = `${userMessage}: ${error.message}`
              }
            }

            setIsCreating(false)
            setTranslationDocumentId(null)
            setCreationStatus({message: userMessage, success: false})
            throw new Error(userMessage)
          }
        }

        if (createdTranslations.length > 0) {
          try {
            const patch = client.patch(metadataDoc._id).append('translations', createdTranslations)
            await patch.commit()
          } catch {
            // Silently handle metadata update errors
          }
        }
      } catch (error) {
        setIsCreating(false)
        setTranslationDocumentId(null)
        setCreationStatus({
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
          success: false,
        })
        throw error
      }
    },
    [
      client,
      currentUser,
      setTranslationDocumentId,
      setIsCreating,
      setCreationStatus,
      translationsConfig.languageField,
    ],
  )

  return {
    clearCreationStatus: () => setCreationStatus(null),
    createMissingTranslations,
    creationStatus,
    isCreating,
    translationDocumentId,
  }
}
