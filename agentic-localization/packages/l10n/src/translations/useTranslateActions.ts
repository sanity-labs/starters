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
 *
 * Studio integration:
 * - documentStore.pair.editOperations() for approve/dismiss/apply (permission-aware)
 * - useDocumentPairPermissions for RBAC gating on metadata writes
 * - client.transaction() for atomic metadata create+patch in translate flow
 */

import {useCallback, useEffect, useMemo, useReducer, useRef, useTransition} from 'react'
import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  getDraftId,
  getPublishedId,
  getVersionId,
  useClient,
  useCurrentUser,
  useDocumentPairPermissions,
  useDocumentStore,
  usePerspective,
} from 'sanity'
import type {TranslationReference} from '@sanity/document-internationalization'
import {randomKey} from '@sanity/util/content'
import {filter, firstValueFrom} from 'rxjs'
import {defineQuery} from 'groq'
import type {
  LocaleTranslation,
  LocalizedObject,
  ResolvedTranslationsConfig,
  TranslationInFlightStatus,
} from '../core/types'
import {getTranslationMetadataId} from '../core/ids'
import {useTranslate} from '../useTranslate'
import {createSemaphore} from './createSemaphore'

// ---------------------------------------------------------------------------
// Constants & queries
// ---------------------------------------------------------------------------

const SOURCE_DOC_QUERY = defineQuery(`*[_id == $id][0]`)

const APPROVE_METADATA_QUERY = defineQuery(
  `*[_id == $metadataId][0]{ workflowStates[]{ _key, language, sourceRevision, source } }`,
)

const DISMISS_WORKFLOW_QUERY = defineQuery(
  `*[_id == $metadataId][0]{ workflowStates[]{ _key, language, source } }`,
)

const DISMISS_SOURCE_REV_QUERY = defineQuery(`*[_id == $publishedId][0]{ _rev }`)

const MAX_CONCURRENT_TRANSLATIONS = 5

const METADATA_TYPE = 'translation.metadata'

const LOG_PREFIX = '[l10n:translate]'

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

/** Create a translation.metadata reference entry (_key auto-generated via `autoGenerateArrayKeys`). */
function createReference(
  localeId: string,
  documentId: string,
  documentType: string,
): Omit<TranslationReference, '_key'> {
  return {
    _type: 'internationalizedArrayReferenceValue',
    language: localeId,
    value: {
      _ref: getPublishedId(documentId),
      _type: 'reference',
      _weak: true,
      _strengthenOnPublish: {type: documentType},
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
  /** Whether the user has permission to update metadata (null while loading) */
  metadataPermission: boolean | null
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
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const currentUser = useCurrentUser()
  const documentStore = useDocumentStore()
  const {perspectiveStack, selectedReleaseId} = usePerspective()
  const {translate} = useTranslate()

  // Deterministic metadata ID derived from the source document
  const computedMetadataId = useMemo(
    () => (documentId ? getTranslationMetadataId(documentId) : null),
    [documentId],
  )
  // Use provided metadataId if available (may come from an existing non-deterministic doc),
  // otherwise fall back to the computed deterministic ID.
  const effectiveMetadataId = metadataId ?? computedMetadataId

  // Permission gating — check if user can update metadata docs
  const [metadataPermissions, metadataPermissionsLoading] = useDocumentPairPermissions({
    id: effectiveMetadataId ?? '',
    type: METADATA_TYPE,
    permission: 'update',
  })
  const metadataPermission = metadataPermissionsLoading
    ? null
    : (metadataPermissions?.granted ?? false)

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
  // Studio operations helper — get patch operation for any document
  // ---------------------------------------------------------------------------

  /**
   * Resolve the `patch` operation from `documentStore.pair.editOperations()`.
   * Waits until the operation is ready (disabled === false).
   * Used for approve, dismiss, and apply actions that need permission-aware writes.
   */
  const getPatchOperation = useCallback(
    async (id: string, type: string, version?: string) => {
      const ops = await firstValueFrom(
        documentStore.pair
          .editOperations(id, type, version)
          .pipe(filter((o) => o.patch.disabled === false)),
      )
      return ops.patch
    },
    [documentStore],
  )

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

      // Fetch source doc for glossary context and to capture _rev for diff tracking
      const sourceDoc = await client.fetch<Record<string, unknown> | null>(
        SOURCE_DOC_QUERY,
        {id: publishedId},
        {perspective: perspectiveStack, signal},
      )
      const sourceRevision = (sourceDoc?._rev as string) ?? undefined
      if (signal.aborted) return
      const result = await translate(
        {
          documentId,
          fromLanguage: {id: baseLanguage, title: baseLanguage},
          languageFieldPath: config.languageField,
          noWrite: true,
          schemaId: '_.schemas.default',
          targetDocument: {operation: 'create'},
          toLanguage: {id: locale.localeId, title: locale.localeTitle},
        },
        sourceDoc ?? undefined,
      )

      if (!result) {
        throw new Error('Translation returned no result')
      }

      if (typeof result._id !== 'string' || !result._id) {
        throw new Error('Translation returned a result without a valid document ID')
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
      const resultPublishedId = getPublishedId(result._id)

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

      // Atomic metadata create-or-update + workflow state in a single transaction.
      // Uses deterministic ID and createIfNotExists to prevent race-condition duplicates.
      const metaId = getTranslationMetadataId(publishedId)
      const sourceRef = createReference(baseLanguage, publishedId, documentType)
      const translationRef = createReference(localeId, resultPublishedId, documentType)

      const tx = client.transaction()
      tx.createIfNotExists({
        _id: metaId,
        _type: METADATA_TYPE,
        translations: [sourceRef],
        schemaTypes: [documentType],
      })
      // Split into two patches because @sanity/client's Patch stores `insert`
      // as a single slot — chaining two .append() calls overwrites the first.
      tx.patch(metaId, (p) =>
        p
          .setIfMissing({translations: [], workflowStates: []})
          .unset([`translations[language=="${localeId}"]`])
          .append('translations', [translationRef]),
      )
      tx.patch(metaId, (p) =>
        p.unset([`workflowStates[language=="${localeId}"]`]).append('workflowStates', [
          {
            language: localeId,
            status: 'needsReview',
            source: 'ai',
            updatedAt: new Date().toISOString(),
            sourceRevision,
          },
        ]),
      )
      await tx.commit({autoGenerateArrayKeys: true})
    },
    [
      documentId,
      baseLanguage,
      documentType,
      locales,
      selectedReleaseId,
      config,
      client,
      translate,
      perspectiveStack,
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
          console.error(`${LOG_PREFIX} [${localeId}] Failed:`, err)
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
      if (!effectiveMetadataId) return

      startApproveTransition(async () => {
        const existingMeta = await client.fetch<{
          workflowStates: Array<
            LocalizedObject & {
              sourceRevision?: string
              source?: string
            }
          > | null
        } | null>(APPROVE_METADATA_QUERY, {metadataId: effectiveMetadataId})
        const existing = existingMeta?.workflowStates?.find((s) => s.language === localeId)

        // Use Studio operations for permission-aware metadata patch.
        // translation.metadata has liveEdit: true, so patch writes directly to published.
        const patch = await getPatchOperation(effectiveMetadataId, METADATA_TYPE)
        patch.execute([
          {setIfMissing: {workflowStates: []}},
          {unset: [`workflowStates[language=="${localeId}"]`]},
          {
            insert: {
              after: 'workflowStates[-1]',
              items: [
                {
                  _key: randomKey(12),
                  language: localeId,
                  status: 'approved',
                  source: existing?.source ?? 'ai',
                  updatedAt: new Date().toISOString(),
                  reviewedBy: currentUser?.id,
                  ...(existing?.sourceRevision && {sourceRevision: existing.sourceRevision}),
                },
              ],
            },
          },
        ])

        scheduleRefresh()
      })
    },
    [
      client,
      effectiveMetadataId,
      currentUser,
      scheduleRefresh,
      startApproveTransition,
      getPatchOperation,
    ],
  )

  const dismissStale = useCallback(
    (localeKeys: string | string[]) => {
      if (!effectiveMetadataId || !documentId) return

      startDismissTransition(async () => {
        const keys = Array.isArray(localeKeys) ? localeKeys : [localeKeys]
        if (keys.length === 0) return

        const publishedId = getPublishedId(documentId)

        const [sourceDoc, existingMeta] = await Promise.all([
          client.fetch(DISMISS_SOURCE_REV_QUERY, {publishedId}, {perspective: perspectiveStack}),
          client.fetch<{
            workflowStates: Array<LocalizedObject & {source?: string}> | null
          } | null>(DISMISS_WORKFLOW_QUERY, {metadataId: effectiveMetadataId}),
        ])

        const currentSourceRev = sourceDoc?._rev
        const existingStates = new Map(
          (existingMeta?.workflowStates ?? []).map((s) => [s.language, s]),
        )

        // Use Studio operations for permission-aware metadata patch
        const patch = await getPatchOperation(effectiveMetadataId, METADATA_TYPE)

        for (const localeKey of keys) {
          const existing = existingStates.get(localeKey)
          patch.execute([
            {setIfMissing: {workflowStates: []}},
            {unset: [`workflowStates[language=="${localeKey}"]`]},
            {
              insert: {
                after: 'workflowStates[-1]',
                items: [
                  {
                    _key: randomKey(12),
                    language: localeKey,
                    status: 'approved',
                    updatedAt: new Date().toISOString(),
                    reviewedBy: currentUser?.id,
                    ...(existing?.source && {source: existing.source}),
                    ...(currentSourceRev && {sourceRevision: currentSourceRev}),
                  },
                ],
              },
            },
          ])
        }

        scheduleRefresh()
      })
    },
    [
      client,
      effectiveMetadataId,
      documentId,
      currentUser,
      perspectiveStack,
      scheduleRefresh,
      startDismissTransition,
      getPatchOperation,
    ],
  )

  /** Apply a single pre-translated field via Studio operations. */
  const applyPreTranslation = useCallback(
    async (translatedDocId: string, fieldName: string, suggestedValue: unknown) => {
      if (!documentType) return
      const publishedId = getPublishedId(translatedDocId)
      const patch = await getPatchOperation(
        publishedId,
        documentType,
        selectedReleaseId || undefined,
      )
      patch.execute([{set: {[fieldName]: suggestedValue}}])
    },
    [documentType, selectedReleaseId, getPatchOperation],
  )

  /** Apply multiple pre-translated fields via Studio operations. */
  const applyAllPreTranslations = useCallback(
    async (
      translatedDocId: string,
      translations: Array<{fieldName: string; suggestedValue: unknown}>,
    ) => {
      if (translations.length === 0 || !documentType) return

      const publishedId = getPublishedId(translatedDocId)
      const setPayload: Record<string, unknown> = {}
      for (const {fieldName, suggestedValue} of translations) {
        setPayload[fieldName] = suggestedValue
      }

      const patch = await getPatchOperation(
        publishedId,
        documentType,
        selectedReleaseId || undefined,
      )
      patch.execute([{set: setPayload}])
    },
    [documentType, selectedReleaseId, getPatchOperation],
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
    metadataPermission,
  }
}
