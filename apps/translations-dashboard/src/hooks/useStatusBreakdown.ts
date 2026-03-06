/**
 * Derived hook: Status breakdown for StatusCards.
 *
 * Shows the distribution of workflow statuses across the corpus,
 * optionally filtered by locale and/or document type.
 *
 * 5 entries: approved, needsReview, stale, usingFallback, missing.
 *
 * All statuses are always present (no filtering of zero counts) so
 * StatusCards can render zero-count cards as ghost/muted. Shows the
 * full taxonomy ("oh, nothing is stale — good") rather than a shifting
 * card count.
 */

import type {TranslationWorkflowStatus} from '@starter/l10n'
import type {BadgeTone} from '@sanity/ui'

import {getStatusDisplay} from '@starter/l10n'
import {useMemo} from 'react'

import {
  type AggregateData,
  buildFallbackMap,
  buildMetadataLookup,
  buildWorkflowStateMap,
  resolveWorkflowStatus,
} from './useTranslationAggregateData'

// --- Types ---

export type StatusBreakdownEntry = {
  /** Count of translations in this status */
  count: number
  /** Human-readable label from design language */
  label: string
  /** Percentage of total */
  percentage: number
  /** Workflow status */
  status: TranslationWorkflowStatus
  /** @sanity/ui Badge tone — typed from getStatusDisplay() return */
  tone: BadgeTone
}

// --- Hook ---

/** Display order: approved → needsReview → stale → usingFallback → missing */
const WORKFLOW_STATUS_ORDER: TranslationWorkflowStatus[] = [
  'approved',
  'needsReview',
  'stale',
  'usingFallback',
  'missing',
]

/**
 * @param aggregateData - The shared aggregate data
 * @param selectedLocale - Optional locale filter
 * @param selectedDocType - Optional document type filter
 */
export function useStatusBreakdown(
  aggregateData: AggregateData,
  selectedLocale?: null | string,
  selectedDocType?: null | string,
): StatusBreakdownEntry[] {
  return useMemo(() => {
    const {baseDocuments, locales, metadata} = aggregateData
    const metadataLookup = buildMetadataLookup(baseDocuments, metadata)
    const fallbackMap = buildFallbackMap(locales)

    const filteredDocs = selectedDocType
      ? baseDocuments.filter((d) => d._type === selectedDocType)
      : baseDocuments

    const filteredLocales = selectedLocale
      ? locales.filter((l) => l.tag === selectedLocale)
      : locales

    const counts: Record<TranslationWorkflowStatus, number> = {
      approved: 0,
      missing: 0,
      needsReview: 0,
      stale: 0,
      usingFallback: 0,
    }

    for (const doc of filteredDocs) {
      const meta = metadataLookup.get(doc._id)
      const translationMap = new Map<string, NonNullable<typeof meta>['translations'][number]>()
      const workflowStateMap = buildWorkflowStateMap(meta?.workflowStates ?? null)

      if (meta?.translations) {
        for (const t of meta.translations) {
          translationMap.set(t._key, t)
        }
      }

      for (const locale of filteredLocales) {
        const translation = translationMap.get(locale.tag)
        const fallbackTag = fallbackMap.get(locale.tag)
        const fallbackTranslation = fallbackTag ? translationMap.get(fallbackTag) : undefined

        const status = resolveWorkflowStatus(
          locale.tag,
          workflowStateMap,
          translation,
          fallbackTranslation,
        )
        counts[status]++
      }
    }

    const total = Object.values(counts).reduce((sum, c) => sum + c, 0)

    return WORKFLOW_STATUS_ORDER.map((status): StatusBreakdownEntry => {
      const display = getStatusDisplay(status)
      const count = counts[status]
      return {
        count,
        label: display.label,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        status,
        tone: display.tone,
      }
    })
  }, [aggregateData, selectedLocale, selectedDocType])
}
