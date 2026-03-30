/**
 * Core aggregation data layer for the translations dashboard.
 *
 * Fetches ALL translation.metadata documents and locale definitions in a single
 * GROQ query, then provides the raw data for derived hooks to aggregate into
 * chart-ready shapes.
 *
 * Architecture: single fetch → derived hooks via useMemo
 *   useTranslationAggregateData() → raw data
 *     ├── useTranslationSummary()
 *     ├── useStatusBreakdown()
 *     ├── useCoverageMatrix()
 *     ├── useGapDocuments()
 *     ├── useRecentChanges()
 *     └── useStaleDocuments()
 *
 * Uses useQuery from @sanity/sdk-react which provides:
 *   - Suspense integration (suspends until first data)
 *   - Real-time reactivity via Live Content API (no polling needed)
 *   - isPending for transition states during param changes
 */

import type {LocalizedObject, TranslationWorkflowStatus, WorkflowStateEntry} from '@starter/l10n'

import {getFlagFromCode} from '@starter/l10n'
import {useQuery} from '@sanity/sdk-react'
import {defineQuery} from 'groq'
import {useMemo} from 'react'

import {useTranslationConfig} from '../contexts/TranslationConfigContext'

// --- Types ---

export type AggregateBaseDocument = {
  _id: string
  _type: string
  title: null | string
}

export type AggregateData = {
  baseDocuments: AggregateBaseDocument[]
  locales: AggregateLocale[]
  metadata: AggregateMetadata[]
}

export type AggregateLocale = {
  fallbackTag: null | string
  flag: string
  tag: string
  title: string
}

export type AggregateMetadata = {
  _id: string
  translations: TranslationMetadataEntry[]
  /** Per-locale workflow states. Null if not yet populated. */
  workflowStates: null | WorkflowStateEntry[]
}

export type TranslationMetadataEntry = LocalizedObject & {
  ref: string
}

// --- GROQ Query ---

const AGGREGATE_QUERY = defineQuery(`{
  "baseDocuments": *[
    _type in $docTypes
    && @[$languageField] == $defaultLanguage
  ]{ _id, _type, title },
  "metadata": *[_type == "translation.metadata"]{
    _id,
    translations[]{
      _key,
      language,
      "ref": value._ref
    },
    workflowStates
  },
  "locales": *[_type == "l10n.locale"]{
    "tag": code,
    title,
    flag,
    "fallbackTag": fallback->code
  }
}`)

// --- Hook ---

/**
 * Build a fallback locale lookup: localeTag → fallbackLocaleTag
 */
export function buildFallbackMap(locales: AggregateLocale[]): Map<string, null | string> {
  const map = new Map<string, null | string>()
  for (const locale of locales) {
    map.set(locale.tag, locale.fallbackTag)
  }
  return map
}

// --- Aggregation Utilities ---

export function buildMetadataLookup(
  baseDocuments: AggregateBaseDocument[],
  metadata: AggregateMetadata[],
): Map<string, AggregateMetadata> {
  const baseDocIds = new Set(baseDocuments.map((d) => d._id))
  const lookup = new Map<string, AggregateMetadata>()

  for (const meta of metadata) {
    if (!meta.translations) continue
    for (const t of meta.translations) {
      if (baseDocIds.has(t.ref)) {
        lookup.set(t.ref, meta)
        break
      }
    }
  }

  return lookup
}

export function buildWorkflowStateMap(
  workflowStates: null | WorkflowStateEntry[],
): Map<string, WorkflowStateEntry> {
  const map = new Map<string, WorkflowStateEntry>()
  if (!workflowStates) return map
  for (const entry of workflowStates) {
    map.set(entry.language, entry)
  }
  return map
}

export function resolveWorkflowStatus(
  localeTag: string,
  workflowStateMap: Map<string, WorkflowStateEntry>,
  translation: TranslationMetadataEntry | undefined,
  fallbackTranslation: TranslationMetadataEntry | undefined,
): TranslationWorkflowStatus {
  const workflowEntry = workflowStateMap.get(localeTag)
  if (workflowEntry) {
    return workflowEntry.status
  }

  if (translation?.ref) {
    return 'needsReview'
  }

  if (fallbackTranslation?.ref) {
    return 'usingFallback'
  }

  return 'missing'
}

/**
 * Core data hook for the translations dashboard.
 *
 * Uses useQuery from @sanity/sdk-react which:
 *   - Suspends until first data resolves (parent must wrap in <Suspense>)
 *   - Provides real-time reactivity via Live Content API (replaces 30s polling)
 *   - Returns isPending=true during transition states (param changes)
 */
export function useTranslationAggregateData(): {data: AggregateData; isPending: boolean} {
  const {defaultLanguage, translationsConfig} = useTranslationConfig()
  const lang = defaultLanguage ?? 'en-US'

  const {data: rawData, isPending} = useQuery<AggregateData>({
    params: {
      defaultLanguage: lang,
      docTypes: translationsConfig.internationalizedTypes,
      languageField: translationsConfig.languageField,
    },
    query: AGGREGATE_QUERY,
  })

  const data = useMemo(() => cleanAggregateData(rawData, lang), [rawData, lang])

  return {data, isPending}
}

/**
 * Filter raw GROQ results to clean data before derived hooks see it.
 */
function cleanAggregateData(raw: AggregateData, defaultLanguage: string): AggregateData {
  const locales = raw.locales
    .filter((l) => l.tag !== defaultLanguage)
    .map((l) => ({...l, flag: l.flag || getFlagFromCode(l.tag)}))

  const baseDocIds = new Set(raw.baseDocuments.map((d) => d._id))
  const metadata = raw.metadata.filter((meta) => {
    if (!meta.translations) return false
    return meta.translations.some((t) => baseDocIds.has(t.ref))
  })

  return {baseDocuments: raw.baseDocuments, locales, metadata}
}
