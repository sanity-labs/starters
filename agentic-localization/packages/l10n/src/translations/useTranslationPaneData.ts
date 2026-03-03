/**
 * Data hook for the Translation Pane (Surface 2).
 *
 * Uses `documentStore.listenQuery()` for realtime locale and metadata
 * subscriptions. Complex status queries (candidate IDs, version refs)
 * are still fetched on-demand and wrapped in a Suspense-compatible promise.
 *
 * Status computation is done client-side using Set lookups
 * instead of per-translation GROQ sub-queries (see s2-c1 perf audit).
 */

import {startTransition, useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  getDraftId,
  getPublishedId,
  isDraftId,
  isVersionId,
  useClient,
  useDocumentStore,
} from 'sanity'
import type {SanityClient} from 'sanity'
import {useObservable} from 'react-rx'
import {of} from 'rxjs'
import {defineQuery} from 'groq'
import type {TRANSLATION_METADATA_QUERY_RESULT} from '@starter/sanity-types'
import type {
  DocumentState,
  LocaleTranslation,
  ResolvedTranslationsConfig,
  StaleAnalysisCache,
  TranslationWorkflowStatus,
  WorkflowStateEntry,
} from '../core/types'
import {workflowStatesToMap} from '../core/types'
import {getTranslationMetadataId} from '../core/ids'

const ALL_LOCALES_QUERY = defineQuery(`*[_type == "l10n.locale"] | order(code asc) {
  _id,
  "id": code,
  title,
  flag,
  "fallbackLocale": fallback->code,
  "releaseId": select(
    _id match "versions.*" => string::split(_id, ".")[1],
    null
  ),
  "status": select(
    _id match "versions.*" => "in_release",
    _id match "drafts.*" => "draft",
    "published"
  )
}`)

const TRANSLATION_METADATA_QUERY = defineQuery(`*[
  _id == $metadataId || (
    _type == "translation.metadata"
    && references($publishedId)
  )
][0]{
  _id,
  workflowStates,
  staleAnalysis,
  "translations": translations[]{
    _key,
    "ref": value._ref
  }
}`)

const CANDIDATE_IDS_QUERY = defineQuery(`*[_id in $candidateIds]._id`)

const BASE_DOC_REF_QUERY = defineQuery(`*[
  _type == "translation.metadata"
  && (references($documentId) || references($publishedId))
][0].translations[_key == $defaultLanguage][0].value._ref`)

// ---------------------------------------------------------------------------
// Locale type
// ---------------------------------------------------------------------------

export type Locale = {
  fallbackLocale?: null | string
  flag: string
  id: string
  releaseId?: string
  status?: 'draft' | 'in_release' | 'published'
  title: string
}

// ---------------------------------------------------------------------------
// Locale deduplication (replaces module-level cache)
// ---------------------------------------------------------------------------

function deduplicateLocales(allLocales: Array<Locale & {_id: string}>): Locale[] {
  const localeMap = new Map<string, Locale>()

  for (const locale of allLocales) {
    const isDraft = isDraftId(locale._id)
    const isInRelease = isVersionId(locale._id)
    const existingLocale = localeMap.get(locale.id)

    const shouldReplace =
      !existingLocale ||
      (isInRelease && existingLocale.status !== 'in_release') ||
      (isDraft && existingLocale.status === 'published')

    if (shouldReplace) {
      const {_id, ...localeWithoutId} = locale
      localeMap.set(locale.id, localeWithoutId)
    }
  }

  return Array.from(localeMap.values())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fully resolved snapshot of translation pane data.
 * Returned by `computeTranslationSnapshot` and consumed via `use()` in the component.
 */
export interface TranslationPaneSnapshot {
  locales: LocaleTranslation[]
  metadataId: string | null
  workflowStates: Record<string, WorkflowStateEntry>
  staleAnalysis: StaleAnalysisCache | null
}

/**
 * Return type for the translation pane data hook.
 */
export interface TranslationPaneData {
  /** Promise that resolves to the pane snapshot (consumed via use()) */
  dataPromise: Promise<TranslationPaneSnapshot> | null
  /** Trigger a refresh (wrapped in startTransition internally) */
  refresh: () => void
}

/**
 * Determine the Sanity document lifecycle state using client-side Set lookups.
 * Priority: inRelease > published > draft > none
 */
function resolveDocumentState(
  ref: string | null,
  publishedIds: Set<string>,
  draftIds: Set<string>,
  versionRefs: Set<string>,
): DocumentState {
  if (!ref) return 'none'
  if (versionRefs.has(ref)) return 'inRelease'
  if (publishedIds.has(ref)) return 'published'
  if (draftIds.has(ref)) return 'draft'
  return 'none'
}

/**
 * Determine the translation workflow status for a locale.
 * Combines document existence with persisted workflow state from metadata.
 */
function resolveTranslationStatus(
  ref: string | null,
  documentState: DocumentState,
  workflowEntry: WorkflowStateEntry | undefined,
  fallbackHasTranslation: boolean,
): TranslationWorkflowStatus {
  const docExists = documentState !== 'none'

  if (!ref && !docExists) {
    return fallbackHasTranslation ? 'usingFallback' : 'missing'
  }

  if (!docExists) {
    return fallbackHasTranslation ? 'usingFallback' : 'missing'
  }

  if (workflowEntry?.status === 'needsReview') return 'needsReview'
  if (workflowEntry?.status === 'approved') return 'approved'
  if (workflowEntry?.status === 'stale') return 'stale'

  return 'needsReview'
}

/**
 * Compute the full per-locale translation snapshot from metadata.
 *
 * Metadata comes from the realtime `listenQuery` subscription.
 * This function only fetches the candidate ID and version ref queries
 * needed for document existence checks.
 */
async function computeTranslationSnapshot(
  client: SanityClient,
  documentId: string,
  allLocales: Locale[],
  metadata: TRANSLATION_METADATA_QUERY_RESULT,
  config: ResolvedTranslationsConfig,
): Promise<TranslationPaneSnapshot> {
  let publishedIds = new Set<string>()
  let draftIds = new Set<string>()
  let versionRefs = new Set<string>()

  if (metadata?.translations?.length) {
    const refs = metadata.translations.flatMap((t) => (t.ref ? [t.ref] : []))
    const candidateIds = [...refs, ...refs.map((r) => getDraftId(r))]

    const versionQuery =
      refs.length > 0
        ? `*[${refs.map((_, i) => `_id match ("versions.*." + $r${i})`).join(' || ')}]._id`
        : `[]`
    const versionParams = Object.fromEntries(refs.map((r, i) => [`r${i}`, r]))

    const [existingIds, existingVersionIds] = await Promise.all([
      client.fetch<string[]>(CANDIDATE_IDS_QUERY, {candidateIds}, {perspective: 'raw'}),
      client.fetch<string[]>(versionQuery, versionParams, {perspective: 'raw'}),
    ])

    const published = new Set<string>()
    const drafts = new Set<string>()
    for (const id of existingIds) {
      if (isDraftId(id)) {
        drafts.add(getPublishedId(id))
      } else {
        published.add(id)
      }
    }

    const versions = new Set<string>()
    for (const id of existingVersionIds) {
      versions.add(getPublishedId(id))
    }

    publishedIds = published
    draftIds = drafts
    versionRefs = versions
  }

  // Compute per-locale status
  const workflowStatesMap = workflowStatesToMap(metadata?.workflowStates)

  const translationMap = new Map<string, string>()
  if (metadata?.translations) {
    for (const t of metadata.translations) {
      if (t.ref) translationMap.set(t._key, t.ref)
    }
  }

  const localesWithTranslations = new Set<string>()
  for (const [localeId, ref] of translationMap) {
    if (publishedIds.has(ref) || draftIds.has(ref) || versionRefs.has(ref)) {
      localesWithTranslations.add(localeId)
    }
  }

  const locales = allLocales
    .filter((locale) => locale.id !== config.defaultLanguage)
    .map((locale): LocaleTranslation => {
      const ref = translationMap.get(locale.id) ?? null

      const fallbackHasTranslation = locale.fallbackLocale
        ? locale.fallbackLocale === config.defaultLanguage ||
          localesWithTranslations.has(locale.fallbackLocale)
        : false

      const documentState = resolveDocumentState(ref, publishedIds, draftIds, versionRefs)
      const workflowEntry = workflowStatesMap[locale.id] as WorkflowStateEntry | undefined
      const translationStatus = resolveTranslationStatus(
        ref,
        documentState,
        workflowEntry,
        fallbackHasTranslation,
      )

      return {
        localeId: locale.id,
        localeTitle: locale.title,
        translationStatus,
        documentState,
        translatedDocumentId: ref ?? undefined,
        flag: locale.flag,
        fallbackLocale: locale.fallbackLocale ?? undefined,
      }
    })

  return {
    locales,
    metadataId: metadata?._id ?? null,
    workflowStates: workflowStatesMap,
    staleAnalysis: (metadata?.staleAnalysis as unknown as StaleAnalysisCache) ?? null,
  }
}

/**
 * Hook that provides translation pane data via a Suspense-compatible promise.
 *
 * Uses `documentStore.listenQuery()` for realtime locale and metadata
 * subscriptions. When metadata changes (e.g., stale function patches),
 * status is automatically re-derived without manual listen+debounce.
 */
export function useTranslationPaneData(
  documentId: string | undefined,
  config: ResolvedTranslationsConfig,
): TranslationPaneData {
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const documentStore = useDocumentStore()

  // 1. Locales from listenQuery (replaces module-level cache)
  const allLocalesRaw$ = useMemo(
    () =>
      documentStore.listenQuery(
        ALL_LOCALES_QUERY,
        {},
        {...DEFAULT_STUDIO_CLIENT_OPTIONS, perspective: 'raw'},
      ),
    [documentStore],
  )
  const allLocalesRaw = useObservable(allLocalesRaw$) as Array<Locale & {_id: string}> | undefined

  // 2. Deduplicate locales (derive during render)
  const allLocales = useMemo(() => {
    if (!allLocalesRaw) return undefined
    return deduplicateLocales(allLocalesRaw)
  }, [allLocalesRaw])

  // 3. Metadata from listenQuery (replaces manual listen+debounce)
  const publishedId = documentId ? getPublishedId(documentId) : undefined
  const metadataId = publishedId ? getTranslationMetadataId(publishedId) : undefined
  const metadata$ = useMemo(
    () =>
      publishedId && metadataId
        ? documentStore.listenQuery(
            TRANSLATION_METADATA_QUERY,
            {metadataId, publishedId},
            DEFAULT_STUDIO_CLIENT_OPTIONS,
          )
        : of(null),
    [documentStore, publishedId, metadataId],
  )
  const metadata = useObservable(metadata$) as TRANSLATION_METADATA_QUERY_RESULT | null | undefined

  // 4. Data promise for complex status queries (candidate IDs, version refs)
  const [dataPromise, setDataPromise] = useState<Promise<TranslationPaneSnapshot> | null>(null)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    if (!documentId || !allLocales || metadata === undefined) {
      setDataPromise(null)
      hasLoadedRef.current = false
      return
    }

    const promise = computeTranslationSnapshot(client, documentId, allLocales, metadata, config)

    if (hasLoadedRef.current) {
      // Subsequent metadata changes: wrap in startTransition to avoid re-suspension
      startTransition(() => setDataPromise(promise))
    } else {
      // Initial load: set directly to trigger Suspense
      hasLoadedRef.current = true
      setDataPromise(promise)
    }
  }, [client, documentId, allLocales, metadata, config])

  const refresh = useCallback(() => {
    if (!documentId || !allLocales || metadata === undefined) return
    startTransition(() => {
      setDataPromise(computeTranslationSnapshot(client, documentId, allLocales, metadata, config))
    })
  }, [client, documentId, allLocales, metadata, config])

  return {dataPromise, refresh}
}

/**
 * Resolve the base (default-language) document ID from translation.metadata.
 *
 * Uses `documentStore.listenQuery()` for realtime updates.
 * Returns `undefined` while loading, `null` if not found, or the document ID.
 */
export function useBaseDocumentId(
  documentId: string | undefined,
  defaultLanguage: string | undefined,
  enabled: boolean,
): string | null | undefined {
  const documentStore = useDocumentStore()
  const publishedId = documentId ? getPublishedId(documentId) : undefined

  const baseDocId$ = useMemo(
    () =>
      enabled && documentId && defaultLanguage && publishedId
        ? documentStore.listenQuery(
            BASE_DOC_REF_QUERY,
            {documentId, publishedId, defaultLanguage},
            DEFAULT_STUDIO_CLIENT_OPTIONS,
          )
        : of(null),
    [documentStore, documentId, publishedId, defaultLanguage, enabled],
  )

  return useObservable(baseDocId$) as string | null | undefined
}
