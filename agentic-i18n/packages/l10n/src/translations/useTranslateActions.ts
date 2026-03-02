/**
 * Translation actions hook for the Translation Pane (Surface 2).
 *
 * Provides per-locale translate, translate-all-missing, and retry actions.
 * Uses React 19 async patterns:
 * - useReducer for in-flight state machine (start/complete/fail/clear)
 * - useTransition for all async mutations (isPending = isTranslating)
 * - AbortController for cancellation on retry and unmount
 * - Promise-based semaphore for max-5 concurrency
 * - CSS-driven progress animation (zero re-renders)
 */

import {useCallback, useEffect, useReducer, useRef, useTransition} from 'react'
import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  getDraftId,
  getPublishedId,
  getVersionId,
  useClient,
  useCurrentUser,
  usePerspective,
} from 'sanity'
import {defineQuery} from 'groq'
import type {
  LocaleTranslation,
  ResolvedTranslationsConfig,
  TranslationInFlightStatus,
} from '../core/types'
import {useTranslationContext} from './useTranslationContext'

// ---------------------------------------------------------------------------
// Constants & queries
// ---------------------------------------------------------------------------

// vX API version required for client.agent.action.translate() calls.
// Dated versions (e.g. '2026-02-01') don't support agent actions.
const TRANSLATE_API_VERSION = 'vX'

const EXISTING_METADATA_QUERY = defineQuery(`*[
  _type == "translation.metadata"
  && (references($docId) || references($publishedId))
][0]{
  _id,
  translations
}`)

const SOURCE_DOC_QUERY = defineQuery(`*[_id == $id][0]`)

const APPROVE_METADATA_QUERY = defineQuery(
  `*[_id == $metadataId][0]{ workflowStates[]{ _key, sourceRevision, source } }`,
)

const DISMISS_WORKFLOW_QUERY = defineQuery(
  `*[_id == $metadataId][0]{ workflowStates[]{ _key, source } }`,
)

const DISMISS_SOURCE_REV_QUERY = defineQuery(`*[_id == $publishedId][0]{ _rev }`)

const MAX_CONCURRENT_TRANSLATIONS = 5

// ---------------------------------------------------------------------------
// Pure helpers (module scope)
// ---------------------------------------------------------------------------

/** Slugify: strips diacritics and normalizes for URLs. */
function sanitySlugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/'/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Upserts a single locale entry in the `workflowStates` array on a metadata document.
 * Removes any existing entry for the locale, then appends the new one.
 */
async function patchWorkflowState(
  client: ReturnType<typeof useClient>,
  metadataId: string,
  localeId: string,
  entry: Record<string, unknown>,
) {
  await client
    .patch(metadataId)
    .setIfMissing({workflowStates: []})
    .unset([`workflowStates[_key=="${localeId}"]`])
    .append('workflowStates', [{_key: localeId, ...entry}])
    .commit()
}

/** Create a translation.metadata reference entry. */
function createMetadataReference(
  localeId: string,
  documentId: string,
  _documentType: string,
): {
  _key: string
  _type: 'internationalizedArrayReferenceValue'
  value: {_ref: string; _type: 'reference'; _weak: true}
} {
  const publishedId = getPublishedId(documentId)
  return {
    _key: localeId,
    _type: 'internationalizedArrayReferenceValue',
    value: {
      _ref: publishedId,
      _type: 'reference',
      _weak: true,
    },
  }
}

/** Classify a translation error into a user-facing message. */
function classifyTranslationError(error: unknown, localeTitle: string): string {
  if (error instanceof Error) {
    if (error.message.includes('Too Many Requests') || error.message.includes('rate limit'))
      return 'Rate limit reached. Please wait and retry.'
    if (error.message.includes('network') || error.message.includes('connection'))
      return 'Network error. Please check your connection and retry.'
    if (error.message.includes('timeout')) return 'Request timed out. Please retry.'
  }
  return `Failed to translate to ${localeTitle}`
}

// ---------------------------------------------------------------------------
// Semaphore — limits concurrent translations to MAX_CONCURRENT_TRANSLATIONS
// ---------------------------------------------------------------------------

interface Semaphore {
  acquire(): Promise<void>
  release(): void
}

function createSemaphore(max: number): Semaphore {
  let count = 0
  const waiting: Array<() => void> = []
  return {
    acquire() {
      if (count < max) {
        count++
        return Promise.resolve()
      }
      return new Promise<void>((resolve) => waiting.push(resolve))
    },
    release() {
      count--
      const next = waiting.shift()
      if (next) {
        count++
        next()
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Reducer — in-flight state machine
// ---------------------------------------------------------------------------

/** Per-locale in-flight state tracked during translation operations. */
interface LocaleInFlightState {
  status: TranslationInFlightStatus
  error?: string
}

type InFlightAction =
  | {type: 'start'; localeId: string}
  | {type: 'fail'; localeId: string; error: string}
  | {type: 'complete'; localeId: string}
  | {type: 'clear'; localeId: string}

function inFlightReducer(
  state: Record<string, LocaleInFlightState>,
  action: InFlightAction,
): Record<string, LocaleInFlightState> {
  switch (action.type) {
    case 'start':
      return {...state, [action.localeId]: {status: 'translating'}}
    case 'fail':
      return {...state, [action.localeId]: {status: 'failed', error: action.error}}
    case 'complete':
    case 'clear': {
      const {[action.localeId]: _, ...rest} = state
      return rest
    }
  }
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/** Return type for the translate actions hook. */
export interface TranslateActionsResult {
  /** Translate a single locale */
  translateLocale: (localeId: string) => void
  /** Translate all actionable locales (missing, usingFallback, stale) */
  translateAllMissing: () => void
  /** Retry a failed translation */
  retryLocale: (localeId: string) => void
  /** Approve a locale's translation (marks it as reviewed) */
  approveLocale: (localeId: string) => void
  /** Dismiss stale status — user confirms translation is still valid */
  dismissStale: (localeKeys: string | string[]) => void
  /** Apply a single pre-translated field to a translated document */
  applyPreTranslation: (
    translatedDocId: string,
    fieldName: string,
    suggestedValue: unknown,
  ) => Promise<void>
  /** Apply multiple pre-translated fields in a single patch (for "Apply All") */
  applyAllPreTranslations: (
    translatedDocId: string,
    translations: Array<{fieldName: string; suggestedValue: unknown}>,
  ) => Promise<void>
  /** Per-locale in-flight states (only for locales with active operations) */
  inFlightStates: Record<string, LocaleInFlightState>
  /** Whether any translation is in progress (isPending from useTransition) */
  isTranslating: boolean
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook providing translation actions for the Translation Pane.
 *
 * Derives the active release from `usePerspective()` internally — no need
 * to pass it as a parameter.
 */
export function useTranslateActions(
  documentId: string | undefined,
  documentType: string | undefined,
  baseLanguage: string | undefined,
  locales: LocaleTranslation[],
  metadataId: string | null,
  config: ResolvedTranslationsConfig,
  onTranslationComplete: () => void,
): TranslateActionsResult {
  const agentClient = useClient({apiVersion: TRANSLATE_API_VERSION})
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const currentUser = useCurrentUser()
  const {perspectiveStack, selectedReleaseId} = usePerspective()
  const {getContextForLocale} = useTranslationContext()

  // Transitions — isPending tracks whether async work is in-flight
  const [isTranslating, startTranslateTransition] = useTransition()
  const [, startApproveTransition] = useTransition()
  const [, startDismissTransition] = useTransition()

  // In-flight state: reducer replaces scattered useState updaters
  const [inFlightStates, dispatch] = useReducer(inFlightReducer, {})

  // Concurrency & cancellation
  const semaphoreRef = useRef(createSemaphore(MAX_CONCURRENT_TRANSLATIONS))
  const abortControllersRef = useRef(new Map<string, AbortController>())

  // Shared debounced refresh — used by translate, approve, and dismiss
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefresh = useCallback(() => {
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current)
    refreshDebounceRef.current = setTimeout(() => {
      refreshDebounceRef.current = null
      onTranslationComplete()
    }, 300)
  }, [onTranslationComplete])

  // Cleanup: abort in-flight translations and clear debounce on unmount
  useEffect(() => {
    const controllers = abortControllersRef.current
    return () => {
      for (const c of controllers.values()) c.abort()
      controllers.clear()
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Core translation logic (pure async — throws on failure, no status management)
  // ---------------------------------------------------------------------------

  const processTranslation = useCallback(
    async (localeId: string, signal: AbortSignal): Promise<void> => {
      if (!documentId || !baseLanguage || !documentType) {
        throw new Error('Document ID, base language, and document type are required')
      }

      const locale = locales.find((l) => l.localeId === localeId)
      if (!locale) {
        throw new Error(`Locale ${localeId} not found`)
      }

      const publishedId = getPublishedId(documentId)

      // Fetch existing metadata for updating after translation
      const existingMetadata = await client.fetch<{
        _id: string
        translations: Array<{_key: string}> | null
      } | null>(EXISTING_METADATA_QUERY, {docId: documentId, publishedId}, {signal})

      if (signal.aborted) return

      // Fetch source doc for glossary context and to capture _rev for diff tracking
      const sourceDoc = await client.fetch<Record<string, unknown> | null>(
        SOURCE_DOC_QUERY,
        {id: publishedId},
        {perspective: perspectiveStack, signal},
      )
      const sourceRevision = (sourceDoc?._rev as string) ?? undefined
      const translationContext = await getContextForLocale(locale.localeId, sourceDoc ?? undefined)

      if (signal.aborted) return

      // Call the AI translation API with glossary/style guide context
      const result = await agentClient.agent.action.translate({
        documentId,
        fromLanguage: {id: baseLanguage, title: baseLanguage},
        languageFieldPath: config.languageField,
        noWrite: true,
        schemaId: '_.schemas.default',
        targetDocument: {operation: 'create'},
        toLanguage: {id: locale.localeId, title: locale.localeTitle},
        ...(translationContext.styleGuide && {styleGuide: translationContext.styleGuide}),
        ...(translationContext.protectedPhrases.length > 0 && {
          protectedPhrases: translationContext.protectedPhrases,
        }),
      })

      if (!result) {
        throw new Error('Translation returned no result')
      }

      if (signal.aborted) return

      // Normalize slug if present (strip diacritics) and add locale prefix
      const slug = result.slug as {current?: string; fullUrl?: string} | undefined
      if (slug?.current) {
        const normalizedSlug = sanitySlugify(slug.current)
        slug.current = normalizedSlug
        const localePath = locale.localeId.toLowerCase()
        slug.fullUrl = `/${localePath}/${normalizedSlug}`
      }

      // Create document as draft or in release
      const resultPublishedId = getPublishedId(result._id as string)

      if (!selectedReleaseId) {
        const draftId = getDraftId(resultPublishedId)
        await client.createOrReplace({
          ...result,
          _id: draftId,
          _type: documentType,
          [config.languageField]: locale.localeId,
        })
      } else {
        const versionId = getVersionId(resultPublishedId, selectedReleaseId)
        await client.action({
          actionType: 'sanity.action.document.version.create',
          document: {
            ...result,
            _id: versionId,
            _type: documentType,
            [config.languageField]: locale.localeId,
          },
          publishedId: resultPublishedId,
        })
      }

      if (signal.aborted) return

      // Update or create metadata + write workflow state
      const sourceRef = createMetadataReference(baseLanguage, publishedId, documentType)
      const translationRef = createMetadataReference(localeId, resultPublishedId, documentType)

      if (existingMetadata) {
        const sourceExists = existingMetadata.translations?.some((t) => t._key === baseLanguage)
        const translationExists = existingMetadata.translations?.some((t) => t._key === localeId)

        let patch = client.patch(existingMetadata._id).setIfMissing({translations: []})

        if (!sourceExists) {
          patch = patch.insert('before', 'translations[0]', [sourceRef])
        }
        if (translationExists) {
          patch = patch.unset([`translations[_key=="${localeId}"]`])
        }
        patch = patch.append('translations', [translationRef])

        await patch.commit()

        await patchWorkflowState(client, existingMetadata._id, localeId, {
          status: 'needsReview',
          source: 'ai',
          updatedAt: new Date().toISOString(),
          sourceRevision,
        })
      } else {
        await client.create({
          _type: 'translation.metadata',
          translations: [sourceRef, translationRef],
          schemaTypes: [documentType],
          workflowStates: [
            {
              _key: localeId,
              status: 'needsReview',
              source: 'ai',
              updatedAt: new Date().toISOString(),
              sourceRevision,
            },
          ],
        })
      }
    },
    [
      documentId,
      baseLanguage,
      documentType,
      locales,
      selectedReleaseId,
      config,
      client,
      agentClient,
      perspectiveStack,
      getContextForLocale,
    ],
  )

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const translateLocale = useCallback(
    (localeId: string) => {
      if (inFlightStates[localeId]) return // already in-flight or failed

      const controller = new AbortController()
      abortControllersRef.current.set(localeId, controller)
      dispatch({type: 'start', localeId}) // urgent update — spinner shows immediately

      startTranslateTransition(async () => {
        await semaphoreRef.current.acquire()
        try {
          if (controller.signal.aborted) return
          await processTranslation(localeId, controller.signal)
          if (!controller.signal.aborted) dispatch({type: 'complete', localeId})
        } catch (err) {
          if (!controller.signal.aborted) {
            const locale = locales.find((l) => l.localeId === localeId)
            dispatch({
              type: 'fail',
              localeId,
              error: classifyTranslationError(err, locale?.localeTitle ?? localeId),
            })
          }
        } finally {
          semaphoreRef.current.release()
          abortControllersRef.current.delete(localeId)
          if (!controller.signal.aborted) scheduleRefresh()
        }
      })
    },
    [inFlightStates, locales, processTranslation, scheduleRefresh, startTranslateTransition],
  )

  const translateAllMissing = useCallback(() => {
    const actionableLocales = locales.filter(
      (l) =>
        l.translationStatus === 'missing' ||
        l.translationStatus === 'usingFallback' ||
        l.translationStatus === 'stale',
    )
    actionableLocales.forEach((l) => translateLocale(l.localeId))
  }, [locales, translateLocale])

  const retryLocale = useCallback(
    (localeId: string) => {
      abortControllersRef.current.get(localeId)?.abort()
      dispatch({type: 'clear', localeId})
      translateLocale(localeId)
    },
    [translateLocale],
  )

  const approveLocale = useCallback(
    (localeId: string) => {
      if (!metadataId) return

      startApproveTransition(async () => {
        const existingMeta = await client.fetch<{
          workflowStates: Array<{_key: string; sourceRevision?: string; source?: string}> | null
        } | null>(APPROVE_METADATA_QUERY, {metadataId})
        const existing = existingMeta?.workflowStates?.find((s) => s._key === localeId)

        await patchWorkflowState(client, metadataId, localeId, {
          status: 'approved',
          source: existing?.source ?? 'ai',
          updatedAt: new Date().toISOString(),
          reviewedBy: currentUser?.id,
          ...(existing?.sourceRevision && {sourceRevision: existing.sourceRevision}),
        })

        scheduleRefresh()
      })
    },
    [client, metadataId, currentUser, scheduleRefresh, startApproveTransition],
  )

  const dismissStale = useCallback(
    (localeKeys: string | string[]) => {
      if (!metadataId || !documentId) return

      startDismissTransition(async () => {
        const keys = Array.isArray(localeKeys) ? localeKeys : [localeKeys]
        if (keys.length === 0) return

        const publishedId = getPublishedId(documentId)

        const [sourceDoc, existingMeta] = await Promise.all([
          client.fetch(DISMISS_SOURCE_REV_QUERY, {publishedId}, {perspective: perspectiveStack}),
          client.fetch<{workflowStates: Array<{_key: string; source?: string}> | null} | null>(
            DISMISS_WORKFLOW_QUERY,
            {metadataId},
          ),
        ])

        const currentSourceRev = sourceDoc?._rev
        const existingStates = new Map((existingMeta?.workflowStates ?? []).map((s) => [s._key, s]))

        for (const localeKey of keys) {
          const existing = existingStates.get(localeKey)
          await patchWorkflowState(client, metadataId, localeKey, {
            status: 'approved',
            updatedAt: new Date().toISOString(),
            reviewedBy: currentUser?.id,
            ...(existing?.source && {source: existing.source}),
            ...(currentSourceRev && {sourceRevision: currentSourceRev}),
          })
        }

        scheduleRefresh()
      })
    },
    [
      client,
      metadataId,
      documentId,
      currentUser,
      perspectiveStack,
      scheduleRefresh,
      startDismissTransition,
    ],
  )

  /** Apply a single pre-translated field. Returns a promise for consumer sequencing. */
  const applyPreTranslation = useCallback(
    async (translatedDocId: string, fieldName: string, suggestedValue: unknown) => {
      const publishedId = getPublishedId(translatedDocId)
      const targetId = selectedReleaseId
        ? getVersionId(publishedId, selectedReleaseId)
        : getDraftId(publishedId)

      await client
        .patch(targetId)
        .set({[fieldName]: suggestedValue})
        .commit()
    },
    [client, selectedReleaseId],
  )

  /** Apply multiple pre-translated fields in a single patch. */
  const applyAllPreTranslations = useCallback(
    async (
      translatedDocId: string,
      translations: Array<{fieldName: string; suggestedValue: unknown}>,
    ) => {
      if (translations.length === 0) return

      const publishedId = getPublishedId(translatedDocId)
      const targetId = selectedReleaseId
        ? getVersionId(publishedId, selectedReleaseId)
        : getDraftId(publishedId)

      const setPayload: Record<string, unknown> = {}
      for (const {fieldName, suggestedValue} of translations) {
        setPayload[fieldName] = suggestedValue
      }

      await client.patch(targetId).set(setPayload).commit()
    },
    [client, selectedReleaseId],
  )

  return {
    translateLocale,
    translateAllMissing,
    retryLocale,
    approveLocale,
    dismissStale,
    applyPreTranslation,
    applyAllPreTranslations,
    inFlightStates,
    isTranslating,
  }
}
