import {useMemo} from 'react'

import type {DashboardStatus} from '../lib/localizationRun'

import {useTranslationConfig} from '../contexts/TranslationConfigContext'
import {documentTypeLabels} from '../consts/documentInternationalization'
import {resolveLocaleStatus} from '../lib/localizationRun'
import {
  type AggregateData,
  buildFallbackMap,
  buildMetadataLookup,
  buildTranslationMap,
} from './useTranslationAggregateData'

export type CoverageCell = {
  /** Approved translations (ready for launch) */
  approved: number
  /** Missing translations (no content at all) */
  missing: number
  /** Translations pending human review */
  needsReview: number
  /** Coverage percentage: (needsReview + approved + stale) / total * 100 — "has direct translation" */
  percentage: number
  /** Stale translations (source changed under an open review) */
  stale: number
  /** Total documents */
  total: number
  /** Locales inside an open run right now */
  translating: number
  /** Translations covered by fallback */
  usingFallback: number
}

export type CoverageMatrixRow = {
  documentType: string
  documentTypeLabel: string
  locales: Record<string, CoverageCell>
}

export type CoverageMatrixResult = {
  data: CoverageMatrixRow[]
  localeColumns: Array<{flag: string; tag: string; title: string}>
}

export function useCoverageMatrix(aggregateData: AggregateData): CoverageMatrixResult {
  const {translationsConfig} = useTranslationConfig()

  return useMemo(() => {
    const {baseDocuments, locales, metadata, runs} = aggregateData
    const metadataLookup = buildMetadataLookup(baseDocuments, metadata)
    const fallbackMap = buildFallbackMap(locales)

    const docsByType = new Map<string, typeof baseDocuments>()
    for (const doc of baseDocuments) {
      const existing = docsByType.get(doc._type) || []
      existing.push(doc)
      docsByType.set(doc._type, existing)
    }

    const rows: CoverageMatrixRow[] = translationsConfig.internationalizedTypes
      .filter((type) => docsByType.has(type))
      .map((docType): CoverageMatrixRow => {
        const docs = docsByType.get(docType) || []
        const localeData: Record<string, CoverageCell> = {}

        for (const locale of locales) {
          const counts: Record<DashboardStatus, number> = {
            approved: 0,
            missing: 0,
            needsReview: 0,
            stale: 0,
            translating: 0,
            usingFallback: 0,
          }

          for (const doc of docs) {
            const translations = buildTranslationMap(metadataLookup.get(doc._id))
            const fallbackTag = fallbackMap.get(locale.tag)

            const {status} = resolveLocaleStatus({
              fallbackTranslated: Boolean(fallbackTag && translations.get(fallbackTag)?.ref),
              localeTag: locale.tag,
              run: runs.get(doc._id),
              translated: Boolean(translations.get(locale.tag)?.ref),
            })
            counts[status]++
          }

          const total = docs.length
          const translated = counts.needsReview + counts.approved + counts.stale
          localeData[locale.tag] = {
            approved: counts.approved,
            missing: counts.missing,
            needsReview: counts.needsReview,
            percentage: total > 0 ? Math.round((translated / total) * 100) : 0,
            stale: counts.stale,
            total,
            translating: counts.translating,
            usingFallback: counts.usingFallback,
          }
        }

        return {
          documentType: docType,
          documentTypeLabel: getDocTypeLabel(docType),
          locales: localeData,
        }
      })

    const localeColumns = locales.map((l) => ({
      flag: l.flag,
      tag: l.tag,
      title: l.title,
    }))

    return {data: rows, localeColumns}
  }, [aggregateData, translationsConfig.internationalizedTypes])
}

function getDocTypeLabel(type: string): string {
  return documentTypeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1)
}
