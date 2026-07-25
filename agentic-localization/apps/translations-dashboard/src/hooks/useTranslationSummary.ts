import {useMemo} from 'react'

import type {DashboardStatus} from '../lib/localizationRun'

import {resolveLocaleStatus} from '../lib/localizationRun'
import {
  type AggregateData,
  buildFallbackMap,
  buildMetadataLookup,
  buildTranslationMap,
} from './useTranslationAggregateData'

export type TranslationSummary = {
  /** Translations approved by a human reviewer */
  approved: number
  /** Launch Readiness: approved / total possible translations */
  launchReadiness: number
  /** Locale tags that have at least one non-missing translation */
  localesAffected: string[]
  /** Translations that are completely missing (no fallback) */
  missing: number
  /** Translations pending human review */
  needsReview: number
  /** Translations whose source moved under an open review */
  stale: number
  /** Total number of base-language documents */
  totalDocuments: number
  /** Total possible translations (docs × locales) */
  totalPossible: number
  /** Translated %: (approved + needsReview + usingFallback + stale) / total */
  translatedPercentage: number
  /** Locales inside an open run right now */
  translating: number
  /** Translations covered by a fallback locale */
  usingFallback: number
}

export function useTranslationSummary(
  aggregateData: AggregateData,
  selectedLocale?: null | string,
  selectedDocType?: null | string,
): TranslationSummary {
  return useMemo(() => {
    const {baseDocuments, locales, metadata, runs} = aggregateData
    const metadataLookup = buildMetadataLookup(baseDocuments, metadata)
    const fallbackMap = buildFallbackMap(locales)

    const filteredDocs = selectedDocType
      ? baseDocuments.filter((d) => d._type === selectedDocType)
      : baseDocuments

    const filteredLocales = selectedLocale
      ? locales.filter((l) => l.tag === selectedLocale)
      : locales

    const counts: Record<DashboardStatus, number> = {
      approved: 0,
      missing: 0,
      needsReview: 0,
      stale: 0,
      translating: 0,
      usingFallback: 0,
    }
    const localesWithTranslations = new Set<string>()

    for (const doc of filteredDocs) {
      const translations = buildTranslationMap(metadataLookup.get(doc._id))
      const run = runs.get(doc._id)

      for (const locale of filteredLocales) {
        const fallbackTag = fallbackMap.get(locale.tag)
        const {status} = resolveLocaleStatus({
          fallbackTranslated: Boolean(fallbackTag && translations.get(fallbackTag)?.ref),
          localeTag: locale.tag,
          run,
          translated: Boolean(translations.get(locale.tag)?.ref),
        })
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
      translating: counts.translating,
      usingFallback: counts.usingFallback,
    }
  }, [aggregateData, selectedLocale, selectedDocType])
}
