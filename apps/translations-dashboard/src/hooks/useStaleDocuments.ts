/**
 * Derived hook: Stale documents for the dashboard stale section.
 *
 * Extracts documents with stale translations from the aggregate data,
 * sorted by oldest staleness first (most urgent). Titles are now fetched
 * per-row via useDocumentProjection, not batch-fetched here.
 *
 * The stale detection Sanity Function writes 'stale' status to
 * workflowStates on translation.metadata. This hook reads that data
 * from the already-fetched aggregate.
 */

import {useMemo} from 'react'

import {
  type AggregateData,
  buildMetadataLookup,
  buildWorkflowStateMap,
} from './useTranslationAggregateData'

// --- Types ---

export interface StaleDocumentEntry {
  /** Published ID of the base-language document */
  documentId: string
  /** Document type */
  documentType: string
  /** Oldest stale timestamp across all locales (for sorting) */
  oldestStaleAt: string | undefined
  /** Stale locales for this document, sorted by oldest first */
  staleLocales: StaleLocaleEntry[]
}

export interface StaleLocaleEntry {
  /** Locale tag (e.g., 'es-MX') */
  localeTag: string
  /** How the translation was originally produced */
  source: 'ai' | 'manual' | undefined
  /** When this locale became stale */
  staleAt: string | undefined
  /** The _rev of the base doc that triggered staleness */
  staleSourceRev: string | undefined
}

export type StaleDocumentsResult = {
  data: StaleDocumentEntry[]
  totalCount: number
}

/** Maximum number of stale documents to display */
const MAX_STALE_DISPLAY = 5

// --- Hook ---

export function useStaleDocuments(aggregateData: AggregateData): StaleDocumentsResult {
  const data = useMemo(() => {
    const {baseDocuments, metadata} = aggregateData
    const metadataLookup = buildMetadataLookup(baseDocuments, metadata)

    const staleEntries: StaleDocumentEntry[] = []

    for (const baseDoc of baseDocuments) {
      const meta = metadataLookup.get(baseDoc._id)
      if (!meta?.workflowStates) continue

      const workflowMap = buildWorkflowStateMap(meta.workflowStates)
      const staleLocales: StaleLocaleEntry[] = []

      for (const [localeTag, entry] of workflowMap) {
        if (entry.status === 'stale') {
          staleLocales.push({
            localeTag,
            source: entry.source,
            staleAt: entry.updatedAt,
            staleSourceRev: entry.staleSourceRev,
          })
        }
      }

      if (staleLocales.length > 0) {
        // Sort locales by oldest stale first
        staleLocales.sort((a, b) => {
          if (!a.staleAt) return -1
          if (!b.staleAt) return 1
          return a.staleAt.localeCompare(b.staleAt)
        })

        staleEntries.push({
          documentId: baseDoc._id,
          documentType: baseDoc._type,
          oldestStaleAt: staleLocales[0]?.staleAt,
          staleLocales,
        })
      }
    }

    // Sort documents by oldest staleness first (most urgent)
    staleEntries.sort((a, b) => {
      if (!a.oldestStaleAt) return -1
      if (!b.oldestStaleAt) return 1
      return a.oldestStaleAt.localeCompare(b.oldestStaleAt)
    })

    return staleEntries
  }, [aggregateData])

  const totalCount = useMemo(() => data.length, [data])

  return {
    data: data.slice(0, MAX_STALE_DISPLAY),
    totalCount,
  }
}
