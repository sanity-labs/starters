import type {Locale} from '../../helpers/getLocales'

import {SparklesIcon} from '@sanity/icons'
import {DocumentId} from '@sanity/id-utils'
import {useClient} from '@sanity/sdk-react'
import {Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {useEffect, useMemo, useState} from 'react'

import {useApp} from '../../contexts/AppContext'
import {useAllTranslationStatuses} from '../../contexts/TranslationStatusContext'
import {useReleases} from '../../hooks/useReleases'
import {useReleaseSelection} from '../../hooks/useReleaseSelection'
import {useSelectiveTranslation} from '../../hooks/useSelectiveTranslation'
import {buildReleaseMap} from '../../lib/releases'
import {ReleaseSelector} from './ReleaseSelector'
import TranslationLanguageItem, {TranslationLanguageItemSkeleton} from './TranslationLanguageItem'

export type Translation = {
  _id: string
  language: null | string
  title: null | string
}

// Extended translation info showing all perspectives where a translation exists
export type TranslationState = {
  draft?: {_id: string; title: null | string} | null
  language: string
  published?: {_id: string; title: null | string} | null
  versions?: Array<{_id: string; releaseId: string; title: null | string}>
}

type TranslationsListProps = {
  availableLanguages: Locale[]
  baseDocumentId: DocumentId
  baseLanguage: string
  currentLanguage?: null | string
  documentType: string
  existingTranslations: Translation[]
  metadataId?: string // From the left side cache
}

const TranslationsList = ({
  availableLanguages,
  baseDocumentId,
  baseLanguage,
  currentLanguage,
  documentType,
  existingTranslations,
  metadataId,
}: TranslationsListProps) => {
  const {sanityClientConfig} = useApp()
  const client = useClient(sanityClientConfig)
  const {releases} = useReleases()
  const [allTranslationStates, setAllTranslationStates] = useState<Map<string, TranslationState>>(
    new Map(),
  )
  const [isLoadingStates, setIsLoadingStates] = useState(true)

  // Get cached data from the left side badges (if available)
  const {allStatuses: cachedStatuses, isLoading: isCacheLoading} =
    useAllTranslationStatuses(metadataId)

  // Memoize filtered arrays to prevent infinite loops
  const validLanguages = useMemo(
    () => availableLanguages.filter((lang) => lang && lang.id),
    [availableLanguages],
  )

  const {selectedRelease, setSelectedRelease} = useReleaseSelection({
    documentId: baseDocumentId,
    targetLocales: validLanguages,
  })

  // Use cached data from left side badges if available, otherwise show loading
  // This eliminates the double-fetch and provides instant feedback
  useEffect(() => {
    if (!baseDocumentId) {
      setAllTranslationStates(new Map())
      setIsLoadingStates(false)
      return
    }

    // If we have cached data from the left side, use it immediately
    if (cachedStatuses && !isCacheLoading) {
      const stateMap = new Map<string, TranslationState>()

      for (const [localeId, status] of Object.entries(cachedStatuses)) {
        if (!status.ref) continue // No translation exists for this locale

        // Build version info from cached release IDs
        const versions: TranslationState['versions'] = status.versionReleaseIds
          ? status.versionReleaseIds.map((releaseId) => ({
              _id: `versions.${releaseId}.${status.ref}`,
              releaseId,
              title: null, // We don't have titles in the cache, but that's okay
            }))
          : undefined

        stateMap.set(localeId, {
          draft: status.draftExists ? {_id: `drafts.${status.ref}`, title: null} : null,
          language: localeId,
          published: status.publishedExists ? {_id: status.ref, title: null} : null,
          versions,
        })
      }

      setAllTranslationStates(stateMap)
      setIsLoadingStates(false)
      return
    }

    // If cache is still loading, wait for it
    if (isCacheLoading) {
      setIsLoadingStates(true)
      return
    }

    // Fallback: If no cached data and not loading, we need to fetch
    // This shouldn't normally happen if the badges have been rendered
    setIsLoadingStates(true)

    const fetchAllTranslationStates = async () => {
      try {
        const publishedDocId = baseDocumentId.startsWith('drafts.')
          ? baseDocumentId.slice(7)
          : baseDocumentId

        const result = await client.fetch<{
          _allTranslations: Array<{
            _key: string
            allVersions: Array<{_id: string; language: null | string; title: null | string}>
            draft?: {_id: string; language: null | string; title: null | string} | null
            published?: {_id: string; language: null | string; title: null | string} | null
            publishedId: string
          }>
        }>(
          `*[_id == $documentId || _id == $publishedDocId][0]{
            "_allTranslations": *[
              _type == "translation.metadata"
              && (references($documentId) || references($publishedDocId))
            ].translations[]{
              _key,
              "publishedId": value._ref,
              "published": *[_id == ^.value._ref][0]{
                _id,
                title,
                language
              },
              "draft": *[_id == "drafts." + ^.value._ref][0]{
                _id,
                title,
                language
              },
              "allVersions": *[_id match "versions.*." + ^.value._ref]{
                _id,
                title,
                language
              }
            }
          }`,
          {documentId: baseDocumentId, publishedDocId},
          {perspective: 'raw'},
        )

        // Build a map of language -> all translation states
        const stateMap = new Map<string, TranslationState>()
        if (result?._allTranslations) {
          for (const t of result._allTranslations) {
            const language = t._key
            if (!language) continue

            const versions: TranslationState['versions'] = []
            if (t.allVersions) {
              for (const v of t.allVersions) {
                // Extract releaseId from versions.{releaseId}.{docId}
                const parts = v._id.split('.')
                if (parts.length >= 3) {
                  versions.push({
                    _id: v._id,
                    releaseId: parts[1],
                    title: v.title,
                  })
                }
              }
            }

            stateMap.set(language, {
              draft: t.draft ? {_id: t.draft._id, title: t.draft.title} : null,
              language,
              published: t.published ? {_id: t.published._id, title: t.published.title} : null,
              versions: versions.length > 0 ? versions : undefined,
            })
          }
        }

        setAllTranslationStates(stateMap)
      } catch (error) {
        console.error('Failed to fetch all translation states:', error)
        setAllTranslationStates(new Map())
      } finally {
        setIsLoadingStates(false)
      }
    }

    fetchAllTranslationStates()
  }, [baseDocumentId, client, cachedStatuses, isCacheLoading])

  const releaseMap = useMemo(() => buildReleaseMap(releases), [releases])

  // Compute translations for the current perspective
  const mergedTranslations = useMemo(() => {
    const translationMap = new Map<string, Translation>()

    // Go through all translation states and pick the right one for current perspective
    for (const [language, state] of allTranslationStates) {
      let translation: null | Translation = null

      if (selectedRelease) {
        // When a release is selected, prefer version in that release
        const versionInRelease = state.versions?.find((v) => v.releaseId === selectedRelease)
        if (versionInRelease) {
          translation = {
            _id: versionInRelease._id,
            language,
            title: versionInRelease.title,
          }
        } else if (state.published) {
          // Fall back to published
          translation = {
            _id: state.published._id,
            language,
            title: state.published.title,
          }
        } else if (state.draft) {
          // Fall back to draft
          translation = {
            _id: state.draft._id,
            language,
            title: state.draft.title,
          }
        }
      } else {
        // "Drafts" perspective - prefer draft, then published
        if (state.draft) {
          translation = {
            _id: state.draft._id,
            language,
            title: state.draft.title,
          }
        } else if (state.published) {
          translation = {
            _id: state.published._id,
            language,
            title: state.published.title,
          }
        }
      }

      if (translation) {
        translationMap.set(language, translation)
      }
    }

    return Array.from(translationMap.values())
  }, [allTranslationStates, selectedRelease])

  const {
    isTranslating,
    retryFailedLanguage,
    translateAllLanguages,
    translateSingleLanguage,
    translationStates,
  } = useSelectiveTranslation(
    baseDocumentId,
    baseLanguage,
    validLanguages,
    mergedTranslations,
    documentType,
    selectedRelease,
    metadataId, // Pass metadataId to update left side cache when translations are created
  )

  // Count completed translations (excluding base language)
  const completedCount = Object.values(translationStates).filter(
    (state) => state.status === 'completed',
  ).length

  const totalTranslations = Object.keys(translationStates).length

  // Check if there are any missing translations
  const hasMissingTranslations = Object.values(translationStates).some(
    (state) => state.status === 'missing',
  )

  // Translations can always be created - either as drafts or into a release
  const canTranslate = true

  return (
    <Card border padding={3}>
      <Stack space={3}>
        {/* Release Selector */}
        <ReleaseSelector
          disabled={false}
          onSelectRelease={setSelectedRelease}
          releases={releases}
          selectedRelease={selectedRelease}
        />

        <Flex align="center" gap={2} justify="space-between">
          <Text size={2} weight="semibold">
            {isLoadingStates
              ? 'Translations (loading...)'
              : `Translations (${completedCount} of ${totalTranslations})`}
          </Text>
          {!isLoadingStates && hasMissingTranslations && (
            <Button
              disabled={isTranslating || !canTranslate}
              icon={SparklesIcon}
              mode="default"
              onClick={translateAllLanguages}
              size={1}
              text="Translate All"
              tone="primary"
            />
          )}
        </Flex>

        <Stack space={2}>
          {isLoadingStates ? (
            // Show loading skeletons while fetching translation states
            <>
              {availableLanguages
                .filter((lang) => lang.id !== baseLanguage)
                .map((language) => (
                  <TranslationLanguageItemSkeleton key={language.id} languageId={language.id} />
                ))}
            </>
          ) : (
            availableLanguages.map((language) => {
              // Skip the base language
              if (language.id === baseLanguage) return null

              const state = translationStates[language.id]
              if (!state) return null

              // Check if fallback translation exists
              const hasFallback =
                language.fallbackLocale !== null && language.fallbackLocale !== undefined

              // Check if fallback exists in mergedTranslations (more reliable than translationStates)
              const fallbackTranslation =
                hasFallback && language.fallbackLocale
                  ? mergedTranslations.find((t) => t.language === language.fallbackLocale)
                  : undefined
              const fallbackExists = fallbackTranslation !== undefined

              // Get comprehensive translation state for this language to show "exists elsewhere" info
              const translationStateForLang = allTranslationStates.get(language.id)

              return (
                <TranslationLanguageItem
                  disabled={!canTranslate}
                  documentType={documentType}
                  error={state.error}
                  fallbackExists={fallbackExists}
                  fallbackLanguage={
                    hasFallback
                      ? availableLanguages.find((l) => l.id === language.fallbackLocale)
                      : undefined
                  }
                  isSelected={language.id === currentLanguage}
                  key={language.id}
                  languageId={state.languageId}
                  languageTitle={state.languageTitle}
                  locale={language}
                  onRetry={() => retryFailedLanguage(language.id)}
                  onTranslate={() => translateSingleLanguage(language.id)}
                  otherPerspectives={translationStateForLang}
                  progress={state.progress}
                  releaseMap={releaseMap}
                  releaseName={state.releaseName}
                  selectedRelease={selectedRelease}
                  status={state.status}
                  translatedDocumentId={state.translatedDocumentId}
                  translatedDocumentTitle={state.translatedDocumentTitle}
                />
              )
            })
          )}
        </Stack>
      </Stack>
    </Card>
  )
}

export default TranslationsList
