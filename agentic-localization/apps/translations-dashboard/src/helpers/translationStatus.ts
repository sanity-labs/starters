import {DocumentId, getPublishedId} from '@sanity/id-utils'
import type {SanityClient} from 'sanity'

import type {
  EnhancedDocument,
  Language,
  LanguageTranslationStatus,
  Translation,
  TranslationSummaryCounts,
} from '../components/BatchTranslationPanel/types'

/**
 * Computes the status of a language translation
 * Returns status, release information, and whether it's locked to a specific release
 */
function computeLanguageStatus(
  language: Language,
  existingTranslations: Translation[],
  availableLanguages: Language[],
  selectedRelease: null | string,
  releaseMap: Map<string, string>,
  workflowStatus?: LanguageTranslationStatus['workflowStatus'],
): LanguageTranslationStatus {
  // Check if translation exists
  const existingTranslation = existingTranslations.find((t) => t.language === language.id)

  if (existingTranslation) {
    // Check if it's in a release
    const isInRelease = existingTranslation._id.startsWith('versions.')
    const releaseId = isInRelease ? existingTranslation._id.split('.')[1] : null
    const releaseName = releaseId ? releaseMap.get(releaseId) || releaseId : undefined

    return {
      hasTranslation: true,
      isInRelease,
      isLocked: !!language.releaseId,
      languageId: language.id,
      languageTitle: language.title,
      releaseName,
      status: 'completed',
      translatedDocumentId: existingTranslation._id,
      translatedDocumentTitle: existingTranslation.title ?? undefined,
      workflowStatus: workflowStatus ?? 'needsReview',
    }
  }

  // Check if fallback exists
  const hasFallback = language.fallbackLocale !== null && language.fallbackLocale !== undefined
  const fallbackTranslation = hasFallback
    ? existingTranslations.find((t) => t.language === language.fallbackLocale)
    : undefined

  if (fallbackTranslation) {
    // Determine which release this will go into
    const targetRelease = language.releaseId || selectedRelease
    const releaseName = targetRelease ? releaseMap.get(targetRelease) || targetRelease : undefined

    return {
      hasTranslation: false,
      isInRelease: false,
      isLocked: !!language.releaseId,
      languageId: language.id,
      languageTitle: language.title,
      releaseName,
      status: 'fallback',
      workflowStatus: workflowStatus ?? 'usingFallback',
    }
  }

  // Missing translation
  const targetRelease = language.releaseId || selectedRelease
  const releaseName = targetRelease ? releaseMap.get(targetRelease) || targetRelease : undefined

  return {
    hasTranslation: false,
    isInRelease: false,
    isLocked: !!language.releaseId,
    languageId: language.id,
    languageTitle: language.title,
    releaseName,
    status: 'missing',
    workflowStatus: workflowStatus ?? 'missing',
  }
}

/**
 * Enriches a document with full translation status information
 */
export async function enrichDocumentWithTranslationStatus(
  client: SanityClient,
  document: EnhancedDocument,
  languages: Language[],
  selectedRelease: null | string,
  releaseMap: Map<string, string>,
  filterLocales?: string[],
): Promise<EnhancedDocument> {
  // Fetch translations for this document
  const existingTranslations = await fetchTranslationsForDocument(
    client,
    document._id,
    selectedRelease,
  )

  // Compute status for each language
  const translationsByLanguage: Record<string, LanguageTranslationStatus> = {}

  const targetLanguages = languages.filter(
    (lang) => lang.id !== document.language && (!filterLocales || filterLocales.includes(lang.id)),
  )

  for (const language of targetLanguages) {
    translationsByLanguage[language.id] = computeLanguageStatus(
      language,
      existingTranslations,
      languages,
      selectedRelease,
      releaseMap,
    )
  }

  // Generate summary counts
  const summaryCount = getTranslationSummaryCounts(
    languages,
    document.language,
    existingTranslations,
    filterLocales,
  )

  return {
    ...document,
    _existingTranslations: existingTranslations,
    _summaryCount: summaryCount,
    _translationsByLanguage: translationsByLanguage,
  }
}

/**
 * Fetches both published and release-specific translations for a document
 * Fetches from ALL releases and merges them, preferring any release version over published
 */
async function fetchTranslationsForDocument(
  client: SanityClient,
  documentId: string,
  selectedRelease: null | string,
): Promise<Translation[]> {
  try {
    // Extract published ID in case documentId is a draft (drafts.xxx -> xxx)
    const publishedId = getPublishedId(documentId as DocumentId)

    // Query fetches translations checking published, draft, and version states
    const result = await client.fetch<{
      _releaseTranslations?: Array<{
        _key: string
        allVersions: Array<{_id: string; language: null | string; title: null | string}>
        draft?: {_id: string; language: null | string; title: null | string} | null
        published?: {_id: string; language: null | string; title: null | string} | null
        publishedId: string
      }>
      _translations?: Array<{
        _id: string
        language: null | string
        title: null | string
      } | null>
    }>(
      `*[_id == $documentId || _id == $publishedId][0]{
        "_translations": *[
          _type == "translation.metadata"
          && (references($documentId) || references($publishedId))
        ].translations[]{
          "translation": coalesce(
            *[_id == ^.value._ref][0],
            *[_id == "drafts." + ^.value._ref][0]
          ){
            _id,
            title,
            language
          }
        }.translation,
        "_releaseTranslations": *[
          _type == "translation.metadata"
          && (references($documentId) || references($publishedId))
        ].translations[]{
          _key,
          language,
          "publishedId": value._ref,
          "allVersions": *[_id match "versions.*." + ^.value._ref]{
            _id,
            title,
            language
          },
          "published": *[_id == ^.value._ref][0]{
            _id,
            title,
            language
          },
          "draft": *[_id == "drafts." + ^.value._ref][0]{
            _id,
            title,
            language
          }
        }
      }`,
      {documentId, publishedId},
      {perspective: 'raw'},
    )

    // Merge translations with priority: version (release) > published > draft
    const translationMap = new Map<string, Translation>()

    // First add base translations (already coalesced: published || draft)
    if (result?._translations) {
      for (const t of result._translations) {
        if (t && t.language) {
          translationMap.set(t.language, t)
        }
      }
    }

    // Then check release translations for more specific state info
    if (result?._releaseTranslations) {
      for (const rt of result._releaseTranslations) {
        // Priority: version > published > draft
        if (rt.allVersions && rt.allVersions.length > 0) {
          // Use the first version found (highest priority)
          const version = rt.allVersions[0]
          if (version && version.language) {
            translationMap.set(version.language, {
              _id: version._id, // Will be "versions.{releaseId}.{docId}"
              language: version.language,
              title: version.title,
            })
          }
        } else if (rt.published && rt.published.language) {
          // Published document exists
          translationMap.set(rt.published.language, {
            _id: rt.publishedId, // Plain published ID
            language: rt.published.language,
            title: rt.published.title,
          })
        } else if (rt.draft && rt.draft.language) {
          // Only draft exists - use draft ID so UI can detect it
          translationMap.set(rt.draft.language, {
            _id: rt.draft._id, // Will be "drafts.{docId}"
            language: rt.draft.language,
            title: rt.draft.title,
          })
        }
      }
    }

    return Array.from(translationMap.values())
  } catch (error) {
    console.error('Failed to fetch translations for document:', documentId, error)
    return []
  }
}

/**
 * Generates summary counts for translation statuses
 */
function getTranslationSummaryCounts(
  languages: Language[],
  baseLanguage: null | string,
  existingTranslations: Translation[],
  filterLocales?: string[],
): TranslationSummaryCounts {
  const counts: TranslationSummaryCounts = {
    fallback: 0,
    inRelease: 0,
    missing: 0,
    translated: 0,
  }

  // Filter out base language
  const targetLanguages = languages.filter(
    (lang) => lang.id !== baseLanguage && (!filterLocales || filterLocales.includes(lang.id)),
  )

  for (const language of targetLanguages) {
    const existingTranslation = existingTranslations.find((t) => t.language === language.id)

    if (existingTranslation) {
      counts.translated++
      // Check if it's in a release
      if (existingTranslation._id.startsWith('versions.')) {
        counts.inRelease++
      }
    } else {
      // Check if fallback exists
      const hasFallback = language.fallbackLocale !== null && language.fallbackLocale !== undefined
      const fallbackTranslation = hasFallback
        ? existingTranslations.find((t) => t.language === language.fallbackLocale)
        : undefined

      if (fallbackTranslation) {
        counts.fallback++
      } else {
        counts.missing++
      }
    }
  }

  return counts
}
