/**
 * Derived hook: documents whose source moved while their localization run was
 * open for review.
 *
 * `sourceChanged` is set by a trigger in `localize-document`'s `review` stage
 * and never re-routes the run — it flags, and the reviewer decides. This is
 * where that flag surfaces outside Studio.
 */

import {useMemo} from 'react'

import type {AggregateData} from './useTranslationAggregateData'

export interface StaleDocumentEntry {
  documentId: string
  documentType: string
  /** A locale of this run failed. Advisory — shipping the rest is a decision. */
  hasFailedLocales: boolean
  instanceId: string
  /** Locales the open run is holding for review. */
  locales: string[]
  /** When the run started — how long the drift has been waiting on someone. */
  since: string
}

export type StaleDocumentsResult = {
  data: StaleDocumentEntry[]
  totalCount: number
}

const MAX_STALE_DISPLAY = 5

export function useStaleDocuments(aggregateData: AggregateData): StaleDocumentsResult {
  const data = useMemo(() => {
    const entries: StaleDocumentEntry[] = []

    for (const doc of aggregateData.baseDocuments) {
      const run = aggregateData.runs.get(doc._id)
      if (!run || run.stage !== 'review' || !run.sourceChanged) continue

      entries.push({
        documentId: doc._id,
        documentType: doc._type,
        hasFailedLocales: run.hasFailedLocales,
        instanceId: run.instanceId,
        locales: run.locales,
        since: run.startedAt,
      })
    }

    // Oldest first — the drift that has been waiting longest
    entries.sort((a, b) => a.since.localeCompare(b.since))

    return entries
  }, [aggregateData])

  return {
    data: data.slice(0, MAX_STALE_DISPLAY),
    totalCount: data.length,
  }
}
