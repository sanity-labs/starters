/**
 * Derived hook: Documents filtered by status.
 *
 * Powers StatusFilterView (`/translations?status=X`). Groups by base document
 * and lists the locales that match, carrying the run behind them so a row can
 * link to it.
 */

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

/** A locale that matches the filtered status for a given document */
export type FilteredLocaleEntry = {
  flag: string
  name: string
  tag: string
}

/** A base document with at least one locale matching the filtered status */
export type StatusFilteredDocument = {
  _id: string
  /** Needed to derive the run's idempotency key when starting one. */
  _rev: string
  _type: string
  /** At least one locale of the open run failed. Advisory. */
  hasFailedLocales: boolean
  /** The open run this document sits in, if any. */
  instanceId: null | string
  locales: FilteredLocaleEntry[]
  title: null | string
}

export type StatusFilteredResult = {
  data: StatusFilteredDocument[]
  /** Total count of doc×locale pairs matching the status */
  totalSlots: number
}

// --- Hook ---

export function useStatusFilteredDocuments(
  aggregateData: AggregateData,
  status: null | DashboardStatus,
  locale?: null | string,
  docType?: null | string,
): StatusFilteredResult {
  return useMemo(() => {
    if (!status) return {data: [], totalSlots: 0}

    const {baseDocuments, locales, metadata, runs} = aggregateData
    const metadataLookup = buildMetadataLookup(baseDocuments, metadata)
    const fallbackMap = buildFallbackMap(locales)
    const localeLookup = new Map(locales.map((l) => [l.tag, l]))

    const filteredDocs = docType ? baseDocuments.filter((d) => d._type === docType) : baseDocuments
    const filteredLocales = locale ? locales.filter((l) => l.tag === locale) : locales

    const documents: StatusFilteredDocument[] = []
    let totalSlots = 0

    for (const doc of filteredDocs) {
      const translations = buildTranslationMap(metadataLookup.get(doc._id))
      const run = runs.get(doc._id)
      const matchingLocales: FilteredLocaleEntry[] = []

      for (const loc of filteredLocales) {
        const fallbackTag = fallbackMap.get(loc.tag)
        const resolved = resolveLocaleStatus({
          fallbackTranslated: Boolean(fallbackTag && translations.get(fallbackTag)?.ref),
          localeTag: loc.tag,
          run,
          translated: Boolean(translations.get(loc.tag)?.ref),
        })

        // The Missing card folds in the fallback count, so its drill-down does too.
        const matches =
          resolved.status === status ||
          (status === 'missing' && resolved.status === 'usingFallback')

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
          _rev: doc._rev,
          _type: doc._type,
          hasFailedLocales: run?.hasFailedLocales ?? false,
          instanceId: run?.instanceId ?? null,
          locales: matchingLocales,
          title: doc.title,
        })
      }
    }

    // Worst gaps first
    documents.sort((a, b) => b.locales.length - a.locales.length)

    return {data: documents, totalSlots}
  }, [aggregateData, status, locale, docType])
}
