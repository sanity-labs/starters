/**
 * Derived hook: Translation summary for the summary bar.
 *
 * Aggregates from useTranslationAggregateData into counts by workflow status,
 * with optional locale/docType filtering.
 *
 * Summary tracks: missing, usingFallback, needsReview, approved, stale.
 *
 * Metrics:
 *   Launch Readiness % = approved / total
 *   Translated % = (approved + needsReview + usingFallback + stale) / total
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

export type TranslationSummary = {
  /** Translations approved by a human reviewer */
  approved: number
  /** Launch Readiness: approved / total possible translations */
  launchReadiness: number
  /** Locale tags that have at least one non-missing translation */
  localesAffected: string[]
  /** Translations that are completely missing (no fallback) */
  missing: number
  /** Translations pending human review (AI-generated or pre-migration) */
  needsReview: number
  /** Translations where source document changed since translation */
  stale: number
  /** Total number of base-language documents */
  totalDocuments: number
  /** Total possible translations (docs × locales) */
  totalPossible: number
  /** Translated %: (approved + needsReview + usingFallback + stale) / total */
  translatedPercentage: number
  /** Translations covered by a fallback locale */
  usingFallback: number
}

// --- Hook ---

/**
 * @param aggregateData - The shared aggregate data from useTranslationAggregateData
 * @param selectedLocale - Optional locale filter for locale-specific summary
 * @param selectedDocType - Optional document type filter
 */
export function useTranslationSummary(
  aggregateData: AggregateData,
  selectedLocale?: null | string,
  selectedDocType?: null | string,
): TranslationSummary {
  return useMemo(() => {
    const {baseDocuments, locales, metadata} = aggregateData
    const metadataLookup = buildMetadataLookup(baseDocuments, metadata)
    const fallbackMap = buildFallbackMap(locales)

    // Filter base documents by type if specified
    const filteredDocs = selectedDocType
      ? baseDocuments.filter((d) => d._type === selectedDocType)
      : baseDocuments

    // Filter locales if specified
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
    const localesWithTranslations = new Set<string>()

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

        if (status !== 'missing') {
          localesWithTranslations.add(locale.tag)
        }
      }
    }

    const totalPossible = filteredDocs.length * filteredLocales.length
    const translated = counts.approved + counts.needsReview + counts.usingFallback + counts.stale
    const launchReadiness =
      totalPossible > 0 ? Math.round((counts.approved / totalPossible) * 100) : 0
    const translatedPercentage =
      totalPossible > 0 ? Math.round((translated / totalPossible) * 100) : 0

    return {
      approved: counts.approved,
      launchReadiness,
      localesAffected: Array.from(localesWithTranslations),
      missing: counts.missing,
      needsReview: counts.needsReview,
      stale: counts.stale,
      totalDocuments: filteredDocs.length,
      totalPossible,
      translatedPercentage,
      usingFallback: counts.usingFallback,
    }
  }, [aggregateData, selectedLocale, selectedDocType])
}
