/**
 * Derived hook: Documents filtered by workflow status.
 *
 * Powers the StatusFilterView shown when navigating to
 * /translations?status=X from a StatusCard click.
 *
 * Iterates the shared aggregate data, filtering to documents that have at
 * least one locale with the given workflow status. Groups by base document,
 * lists affected locales per document.
 *
 * Data source: AggregateData (same single GROQ fetch as all other derived hooks).
 */

import type {TranslationWorkflowStatus} from '@starter/l10n'

import {useMemo} from 'react'

import {
  type AggregateData,
  buildFallbackMap,
  buildMetadataLookup,
  buildWorkflowStateMap,
  resolveWorkflowStatus,
} from './useTranslationAggregateData'

// --- Types ---

/** A locale that matches the filtered status for a given document */
export type FilteredLocaleEntry = {
  flag: string
  name: string
  tag: string
}

/** A base document with at least one locale matching the filtered status */
export type StatusFilteredDocument = {
  /** Base document ID */
  _id: string
  /** Document type */
  _type: string
  /** Locales that have this status */
  locales: FilteredLocaleEntry[]
  /** Document title (null if untitled) */
  title: null | string
}

export type StatusFilteredResult = {
  data: StatusFilteredDocument[]
  /** Total count of doc×locale pairs matching the status */
  totalSlots: number
}

// --- Hook ---

/**
 * @param aggregateData - The shared aggregate data
 * @param status - Workflow status to filter by
 * @param locale - Optional locale sub-filter
 * @param docType - Optional document type sub-filter
 */
export function useStatusFilteredDocuments(
  aggregateData: AggregateData,
  status: null | TranslationWorkflowStatus,
  locale?: null | string,
  docType?: null | string,
): StatusFilteredResult {
  return useMemo(() => {
    if (!status) return {data: [], totalSlots: 0}

    const {baseDocuments, locales, metadata} = aggregateData
    const metadataLookup = buildMetadataLookup(baseDocuments, metadata)
    const fallbackMap = buildFallbackMap(locales)

    // Build locale display lookup
    const localeLookup = new Map(locales.map((l) => [l.tag, l]))

    // Apply optional sub-filters
    const filteredDocs = docType ? baseDocuments.filter((d) => d._type === docType) : baseDocuments
    const filteredLocales = locale ? locales.filter((l) => l.tag === locale) : locales

    const documents: StatusFilteredDocument[] = []
    let totalSlots = 0

    for (const doc of filteredDocs) {
      const meta = metadataLookup.get(doc._id)
      const translationMap = new Map<string, NonNullable<typeof meta>['translations'][number]>()
      const workflowStateMap = buildWorkflowStateMap(meta?.workflowStates ?? null)

      if (meta?.translations) {
        for (const t of meta.translations) {
          translationMap.set(t.language, t)
        }
      }

      const matchingLocales: FilteredLocaleEntry[] = []

      for (const loc of filteredLocales) {
        const translation = translationMap.get(loc.tag)
        const fallbackTag = fallbackMap.get(loc.tag)
        const fallbackTranslation = fallbackTag ? translationMap.get(fallbackTag) : undefined

        const resolvedStatus = resolveWorkflowStatus(
          loc.tag,
          workflowStateMap,
          translation,
          fallbackTranslation,
        )

        // For "missing" status filter, also include "usingFallback" —
        // the Missing card folds in fallback count, so the drill-down
        // should show both missing and fallback documents.
        const matches =
          resolvedStatus === status || (status === 'missing' && resolvedStatus === 'usingFallback')

        if (matches) {
          const localeInfo = localeLookup.get(loc.tag)
          matchingLocales.push({
            flag: localeInfo?.flag ?? '',
            name: localeInfo?.title ?? loc.tag,
            tag: loc.tag,
          })
          totalSlots++
        }
      }

      if (matchingLocales.length > 0) {
        documents.push({
          _id: doc._id,
          _type: doc._type,
          locales: matchingLocales,
          title: doc.title,
        })
      }
    }

    // Sort by number of matching locales descending (worst gaps first)
    documents.sort((a, b) => b.locales.length - a.locales.length)

    return {data: documents, totalSlots}
  }, [aggregateData, status, locale, docType])
}
