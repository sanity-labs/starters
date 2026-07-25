/**
 * Derived hook: Status breakdown for StatusCards.
 *
 * Every status is always present, zero counts included, so the cards show the
 * whole taxonomy ("nothing is stale — good") rather than a shifting card count.
 */

import type {BadgeTone} from '@sanity/ui'

import {getStatusDisplay} from '@starter/l10n'
import {useMemo} from 'react'

import type {DashboardStatus} from '../lib/localizationRun'

import {resolveLocaleStatus} from '../lib/localizationRun'
import {
  type AggregateData,
  buildFallbackMap,
  buildMetadataLookup,
  buildTranslationMap,
} from './useTranslationAggregateData'

// --- Types ---

export type StatusBreakdownEntry = {
  count: number
  label: string
  percentage: number
  status: DashboardStatus
  /** @sanity/ui Badge tone — typed from getStatusDisplay() return */
  tone: BadgeTone
}

// --- Hook ---

const STATUS_ORDER: DashboardStatus[] = [
  'translating',
  'approved',
  'needsReview',
  'stale',
  'usingFallback',
  'missing',
]

export function useStatusBreakdown(
  aggregateData: AggregateData,
  selectedLocale?: null | string,
  selectedDocType?: null | string,
): StatusBreakdownEntry[] {
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
      }
    }

    const total = Object.values(counts).reduce((sum, c) => sum + c, 0)

    return STATUS_ORDER.map((status): StatusBreakdownEntry => {
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
