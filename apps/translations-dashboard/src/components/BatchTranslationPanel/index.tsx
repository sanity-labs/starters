import {Card, Heading, Stack} from '@sanity/ui'
import {useEffect, useMemo, useState} from 'react'

import {useApp} from '../../contexts/AppContext'
import {useBatchAutoProvisionMetadata} from '../../hooks/useBatchAutoProvisionMetadata'
import {useBatchProcessState} from '../../hooks/useBatchProcessState'
import {useBatchTranslationsWithProgress} from '../../hooks/useBatchTranslationsWithProgress'
import {useBulkSetDocumentLanguage} from '../../hooks/useBulkSetDocumentLanguage'
import {useTranslationConfig} from '../../contexts/TranslationConfigContext'
import {useReleases} from '../../hooks/useReleases'
import {buildReleaseMap} from '../../lib/releases'
import {ReleaseSelector} from '../DocumentDetail/ReleaseSelector'
import {Separator} from '../ui/separator'
import ActionButtons from './ActionButtons'
import {BulkLanguageCard, BulkLanguageProgress} from './BulkLanguageCard'
import DocumentAccordionItem from './DocumentAccordionItem'
import LocaleToggles from './LocaleToggles'
import StatusMessage from './StatusMessage'
import type {DocumentTranslationProgress, EnhancedDocument} from './types'

type BatchTranslationPanelProps = Record<string, never>

const BatchTranslationPanel = (_props: BatchTranslationPanelProps) => {
  const {
    batchTranslationStatus,
    defaultLanguage,
    isBatchTranslating,
    selectedDocuments,
    selectedDocumentType,
    setBatchTranslationStatus,
  } = useApp()

  const {languages} = useTranslationConfig()
  const {batchTranslateDocumentsWithProgress, validateSelectedDocuments} =
    useBatchTranslationsWithProgress()
  const {bulkLanguageProgress, bulkSetDocumentLanguage, isBulkSettingLanguage} =
    useBulkSetDocumentLanguage()
  const {provisionMetadataForDocuments} = useBatchAutoProvisionMetadata()
  const {releases} = useReleases()

  const [validDocuments, setValidDocuments] = useState<EnhancedDocument[]>([])
  const [invalidDocuments, setInvalidDocuments] = useState<EnhancedDocument[]>([])
  const [fullyTranslatedDocuments, setFullyTranslatedDocuments] = useState<EnhancedDocument[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [selectedRelease, setSelectedRelease] = useState<null | string>(null)
  const [translationProgress, setTranslationProgress] = useState<
    Record<string, DocumentTranslationProgress>
  >({})

  // All target locales = all locales minus base/default language
  const allTargetLocales = useMemo(
    () => languages.filter((l) => l.id !== defaultLanguage),
    [languages, defaultLanguage],
  )
  const [selectedLocales, setSelectedLocales] = useState<string[]>(
    allTargetLocales.map((l) => l.id),
  )

  // Keep selectedLocales in sync when languages change
  useEffect(() => {
    setSelectedLocales(allTargetLocales.map((l) => l.id))
  }, [allTargetLocales])

  const {currentState} = useBatchProcessState(
    validDocuments,
    invalidDocuments,
    fullyTranslatedDocuments,
    isValidating,
  )

  const releaseMap = useMemo(() => buildReleaseMap(releases), [releases])

  useEffect(() => {
    const validateDocuments = async () => {
      if (selectedDocuments.length === 0) {
        setValidDocuments([])
        setInvalidDocuments([])
        setFullyTranslatedDocuments([])
        return
      }

      setIsValidating(true)
      try {
        const result = await validateSelectedDocuments(
          selectedDocuments,
          languages,
          selectedRelease,
          releaseMap,
        )

        // Auto-provision metadata for documents that have language but no metadata
        const documentsNeedingMetadata = result.invalidDocuments.filter(
          (doc): doc is {language: string} & EnhancedDocument =>
            doc.language != null && typeof doc.language === 'string',
        )

        if (documentsNeedingMetadata.length > 0) {
          console.log(
            `🔧 Auto-provisioning metadata for ${documentsNeedingMetadata.length} documents`,
          )

          const documentsToProvision = documentsNeedingMetadata.map((doc) => ({
            _id: doc._id,
            language: doc.language as string,
            schemaType: doc._type || selectedDocumentType,
          }))

          const {successIds} = await provisionMetadataForDocuments(documentsToProvision)

          if (successIds.length > 0) {
            // Re-validate to update the status of provisioned documents
            console.log(
              `✅ Re-validating after provisioning ${successIds.length} metadata documents`,
            )
            const revalidatedResult = await validateSelectedDocuments(
              selectedDocuments,
              languages,
              selectedRelease,
              releaseMap,
            )
            setValidDocuments(revalidatedResult.validDocuments)
            setInvalidDocuments(revalidatedResult.invalidDocuments)
            setFullyTranslatedDocuments(revalidatedResult.fullyTranslatedDocuments)

            // Initialize translation progress for re-validated documents
            const revalidatedProgress: Record<string, DocumentTranslationProgress> = {}

            revalidatedResult.validDocuments.forEach((doc) => {
              const missingLanguages = languages.filter((lang) => lang.id !== doc.language)
              if (missingLanguages.length > 0) {
                revalidatedProgress[doc._id] = {
                  translations: missingLanguages.map((lang) => ({
                    languageId: lang.id,
                    languageTitle: lang.title,
                    status: 'pending',
                  })),
                }
              }
            })

            revalidatedResult.fullyTranslatedDocuments.forEach((doc) => {
              const allLanguages = languages.filter((lang) => lang.id !== doc.language)
              revalidatedProgress[doc._id] = {
                translations: allLanguages.map((lang) => ({
                  languageId: lang.id,
                  languageTitle: lang.title,
                  status: 'created',
                })),
              }
            })

            setTranslationProgress(revalidatedProgress)
            return
          }
        }

        setValidDocuments(result.validDocuments)
        setInvalidDocuments(result.invalidDocuments)
        setFullyTranslatedDocuments(result.fullyTranslatedDocuments)

        // Initialize translation progress for all documents to show all languages
        const initialProgress: Record<string, DocumentTranslationProgress> = {}

        result.validDocuments.forEach((doc) => {
          const missingLanguages = languages.filter(
            (lang) => lang.id !== doc.language && selectedLocales.includes(lang.id),
          )
          if (missingLanguages.length > 0) {
            initialProgress[doc._id] = {
              translations: missingLanguages.map((lang) => ({
                languageId: lang.id,
                languageTitle: lang.title,
                status: 'pending',
              })),
            }
          }
        })

        result.fullyTranslatedDocuments.forEach((doc) => {
          const allLanguages = languages.filter((lang) => lang.id !== doc.language)
          initialProgress[doc._id] = {
            translations: allLanguages.map((lang) => ({
              languageId: lang.id,
              languageTitle: lang.title,
              status: 'created',
            })),
          }
        })

        setTranslationProgress(initialProgress)
      } catch (error) {
        console.error('Failed to validate documents:', error)
        setValidDocuments([])
        setInvalidDocuments([])
        setFullyTranslatedDocuments([])
      } finally {
        setIsValidating(false)
      }
    }

    validateDocuments()
  }, [
    selectedDocuments,
    selectedDocumentType,
    selectedLocales,
    validateSelectedDocuments,
    provisionMetadataForDocuments,
    languages,
    selectedRelease,
    releaseMap,
  ])

  const handleBatchTranslate = async () => {
    if (selectedDocuments.length === 0 || invalidDocuments.length > 0) return

    try {
      if (currentState === 'LOCALES_SET_COMPLETE') {
        setBatchTranslationStatus(null)
      }

      const initialProgress: Record<string, DocumentTranslationProgress> = {}

      validDocuments.forEach((doc) => {
        const missingLanguages = languages.filter((lang) => lang.id !== doc.language)
        if (missingLanguages.length > 0) {
          initialProgress[doc._id] = {
            translations: missingLanguages.map((lang) => ({
              languageId: lang.id,
              languageTitle: lang.title,
              status: 'pending',
            })),
          }
        }
      })

      fullyTranslatedDocuments.forEach((doc) => {
        const allLanguages = languages.filter(
          (lang) => lang.id !== doc.language && selectedLocales.includes(lang.id),
        )
        initialProgress[doc._id] = {
          translations: allLanguages.map((lang) => ({
            languageId: lang.id,
            languageTitle: lang.title,
            status: 'created',
          })),
        }
      })

      setTranslationProgress(initialProgress)

      await batchTranslateDocumentsWithProgress(
        selectedDocuments,
        languages.filter((l) => selectedLocales.includes(l.id)),
        (documentId, progress) => {
          setTranslationProgress((prev) => ({
            ...prev,
            [documentId]: progress,
          }))
        },
        selectedRelease,
      )
    } catch (error) {
      console.error('Batch translation failed:', error)
    }
  }

  const handleBulkSetLanguage = async () => {
    if (invalidDocuments.length === 0 || !defaultLanguage) return

    try {
      const invalidDocumentIds = invalidDocuments.map((doc) => doc._id)
      await bulkSetDocumentLanguage({
        availableLanguages: languages,
        documentIds: invalidDocumentIds,
        documentType: selectedDocumentType,
        languageId: defaultLanguage,
      })

      setTimeout(() => {
        const validateDocuments = async () => {
          try {
            const result = await validateSelectedDocuments(
              selectedDocuments,
              languages,
              selectedRelease,
              releaseMap,
            )
            setValidDocuments(result.validDocuments)
            setInvalidDocuments(result.invalidDocuments)
            setFullyTranslatedDocuments(result.fullyTranslatedDocuments)

            setBatchTranslationStatus({
              message: 'Document locales have been set! Ready to start batch translation.',
              success: undefined,
            })
          } catch (error) {
            console.error('Failed to re-validate after language setting:', error)
          }
        }
        validateDocuments()
      }, 1000)
    } catch (error) {
      console.error('Bulk language setting failed:', error)
    }
  }

  // Allow translation with or without a release - drafts mode is valid too
  // selectedRelease: null (initial/Drafts), '' (empty string), or a release name
  const canTranslate =
    (validDocuments.length > 0 || fullyTranslatedDocuments.length > 0) &&
    invalidDocuments.length === 0 &&
    !isValidating &&
    selectedLocales.length > 0
  const hasWorkToDo = validDocuments.length > 0

  // For display purposes - check if a specific release is selected vs Drafts mode
  const hasValidReleaseSelected = !!selectedRelease

  return (
    <Card
      className="fixed flex flex-col h-full w-[calc(50%-24px)]"
      padding={4}
      radius={2}
      shadow={1}
    >
      <Stack className="overflow-y-auto flex-1 h-full" space={4}>
        <Heading align="center" as="h2" size={2} weight="semibold">
          Batch Translation
        </Heading>
        <ReleaseSelector
          disabled={isBatchTranslating}
          onSelectRelease={setSelectedRelease}
          releases={releases}
          selectedRelease={selectedRelease}
        />
        <LocaleToggles
          allTargetLocales={allTargetLocales}
          disabled={isBatchTranslating}
          onSelectLocales={setSelectedLocales}
          selectedLocales={selectedLocales}
        />
        <Separator />

        <DocumentAccordionItem
          currentState={currentState}
          documentType={selectedDocumentType}
          fullyTranslatedDocuments={fullyTranslatedDocuments}
          invalidDocuments={invalidDocuments}
          isValidating={isValidating}
          languages={languages.filter(
            (l) => selectedLocales.includes(l.id) || l.id === defaultLanguage,
          )}
          releaseMap={releaseMap}
          selectedDocuments={selectedDocuments}
          selectedRelease={selectedRelease}
          translationProgress={translationProgress}
          validDocuments={validDocuments}
        />

        {bulkLanguageProgress && (
          <BulkLanguageProgress bulkLanguageProgress={bulkLanguageProgress} />
        )}

        <BulkLanguageCard
          bulkLanguageProgress={bulkLanguageProgress}
          defaultLanguage={defaultLanguage}
          invalidDocuments={invalidDocuments}
          isBulkSettingLanguage={isBulkSettingLanguage}
          onBulkSetLanguage={handleBulkSetLanguage}
        />

        <ActionButtons
          canTranslate={canTranslate}
          currentState={currentState}
          fullyTranslatedDocuments={fullyTranslatedDocuments}
          hasWorkToDo={hasWorkToDo}
          invalidDocuments={invalidDocuments}
          isBatchTranslating={isBatchTranslating}
          onBatchTranslate={handleBatchTranslate}
          validDocuments={validDocuments}
        />

        <StatusMessage
          batchTranslationStatus={batchTranslationStatus}
          canTranslate={canTranslate}
          fullyTranslatedDocuments={fullyTranslatedDocuments}
          hasValidReleaseSelected={hasValidReleaseSelected}
          hasWorkToDo={hasWorkToDo}
          invalidDocuments={invalidDocuments}
        />
      </Stack>
    </Card>
  )
}

export default BatchTranslationPanel
