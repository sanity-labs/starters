/**
 * Translations route — the "act" mode.
 *
 * Three states:
 * 1. With type+locale params (?type=article&locale=es-MX) → GapCloserView
 *    Focused action screen: "12 articles need translation in Mexican Spanish"
 *    with source status breakdown, hero batch CTA, and actionability-sorted list.
 *
 * 2. With status param (?status=missing) → StatusFilterView
 *    Actionable document list with batch CTAs for missing/stale and
 *    "Open in Studio →" deep links for single-doc actions.
 *
 * 3. Without params → GapSelectorView
 *    "Choose a gap to close" with top gaps from the coverage matrix as cards.
 *    The Translations route is always purposeful — no generic browse mode.
 */

import type {TranslationWorkflowStatus} from '@starter/l10n'
import type {DocumentId} from '@sanity/id-utils'

import {ArrowLeftIcon} from '@sanity/icons'
import {Button, Stack} from '@sanity/ui'
import {useCallback, useMemo, useState} from 'react'
import {useNavigate, useSearchParams} from 'react-router-dom'

import {documentTypeLabels} from '../components/DocumentTypeSelector'
import ErrorBoundary from '../components/ErrorBoundary'
import GapCloserView from '../components/GapCloserView'
import GapSelectorView from '../components/GapSelectorView'
import StatusFilterView from '../components/StatusFilterView'
import {useApp} from '../contexts/AppContext'
import {useCoverageMatrix} from '../hooks/useCoverageMatrix'
import {useCreateMissingTranslations} from '../hooks/useCreateMissingTranslations'
import {useGapDocuments} from '../hooks/useGapDocuments'
import {useReleases} from '../hooks/useReleases'
import {type RetranslateTarget, useRetranslateStale} from '../hooks/useRetranslateStale'
import {useStatusFilteredDocuments} from '../hooks/useStatusFilteredDocuments'
import {useTranslationAggregateData} from '../hooks/useTranslationAggregateData'

/** Valid workflow statuses for the ?status= param */
const VALID_STATUSES = new Set<string>([
  'missing',
  'needsReview',
  'stale',
  'approved',
  'usingFallback',
])

function TranslationsRoute() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {defaultLanguage, languages} = useApp()

  // Read filters from URL params
  const typeParam = searchParams.get('type')
  const localeParam = searchParams.get('locale')
  const statusParam = searchParams.get('status')

  // Validate status param
  const validatedStatus =
    statusParam && VALID_STATUSES.has(statusParam)
      ? (statusParam as TranslationWorkflowStatus)
      : null

  // Three modes:
  // 1. type + locale → GapCloserView (existing)
  // 2. status (± locale, ± type) → StatusFilterView (NEW)
  // 3. no params → GapSelectorView (existing)
  const hasGapFilter = typeParam !== null && localeParam !== null
  const hasStatusFilter = validatedStatus !== null

  // Aggregate data — shared between all views
  const {data: aggregateData} = useTranslationAggregateData()

  // Gap documents — only computed when type+locale filter params are present
  const gapData = useGapDocuments(aggregateData, typeParam, localeParam)

  // Status-filtered documents — only computed when status param is present
  const statusFilterResult = useStatusFilteredDocuments(
    aggregateData,
    validatedStatus,
    localeParam,
    typeParam,
  )

  // Batch translate hooks — shared between StatusFilterView and GapCloserView
  const {createMissingTranslations, isCreating: isBatchCreating} = useCreateMissingTranslations()
  const {
    isRetranslating,
    progress: retranslateProgress,
    retranslateStale,
  } = useRetranslateStale(aggregateData)

  // Build batch translate handler for missing status
  // Accepts targetReleaseId from the release picker in StatusFilterView
  const handleBatchTranslateMissing = useCallback(
    async (targetReleaseId?: string) => {
      if (!statusFilterResult.data || validatedStatus !== 'missing') return

      // For each document × locale pair, create missing translations
      for (const doc of statusFilterResult.data) {
        const targetLocales = doc.locales.map((l) => ({id: l.tag, title: l.name}))
        await createMissingTranslations(
          doc._id as DocumentId,
          defaultLanguage,
          targetLocales,
          doc._type,
          targetReleaseId,
        )
      }
    },
    [statusFilterResult.data, validatedStatus, createMissingTranslations, defaultLanguage],
  )

  // Build batch re-translate handler for stale status
  const handleBatchRetranslateStale = useCallback(
    async (targetReleaseId?: string) => {
      if (!statusFilterResult.data || validatedStatus !== 'stale') return

      const targets: RetranslateTarget[] = []
      for (const doc of statusFilterResult.data) {
        for (const locale of doc.locales) {
          targets.push({
            baseDocId: doc._id,
            localeName: locale.name,
            localeTag: locale.tag,
          })
        }
      }

      await retranslateStale(targets, targetReleaseId)
    },
    [statusFilterResult.data, validatedStatus, retranslateStale],
  )

  // Resolve which batch handler to use based on status
  const batchTranslateHandler = useMemo<((targetReleaseId?: string) => void) | undefined>(() => {
    if (validatedStatus === 'missing') return handleBatchTranslateMissing
    if (validatedStatus === 'stale') return handleBatchRetranslateStale
    return undefined
  }, [validatedStatus, handleBatchTranslateMissing, handleBatchRetranslateStale])

  const isBatchTranslating = isBatchCreating || isRetranslating
  const batchProgress = retranslateProgress
    ? {completed: retranslateProgress.completed, total: retranslateProgress.total}
    : null

  // GapCloserView translate handlers — wire real hooks instead of simulateTranslate
  // Track which docs are translating/translated for per-row state in GapCloserView
  const [gapTranslatingIds, setGapTranslatingIds] = useState<Set<string>>(new Set())
  const [gapTranslatedIds, setGapTranslatedIds] = useState<Set<string>>(new Set())

  const handleGapTranslateSingle = useCallback(
    async (docId: string, docType: string, targetReleaseId?: string) => {
      if (!localeParam) return
      setGapTranslatingIds((prev) => new Set(prev).add(docId))
      try {
        await createMissingTranslations(
          docId as DocumentId,
          defaultLanguage,
          [{id: localeParam, title: localeParam}],
          docType,
          targetReleaseId,
        )
        setGapTranslatedIds((prev) => new Set(prev).add(docId))
      } finally {
        setGapTranslatingIds((prev) => {
          const next = new Set(prev)
          next.delete(docId)
          return next
        })
      }
    },
    [localeParam, defaultLanguage, createMissingTranslations],
  )

  const handleGapTranslateBatch = useCallback(
    async (docIds: string[], docTypes: string[], targetReleaseId?: string) => {
      if (!localeParam) return
      // Mark all as translating
      setGapTranslatingIds((prev) => {
        const next = new Set(prev)
        docIds.forEach((id) => next.add(id))
        return next
      })
      // Translate sequentially (same pattern as StatusFilterView batch)
      for (let i = 0; i < docIds.length; i++) {
        try {
          await createMissingTranslations(
            docIds[i] as DocumentId,
            defaultLanguage,
            [{id: localeParam, title: localeParam}],
            docTypes[i],
            targetReleaseId,
          )
          setGapTranslatedIds((prev) => new Set(prev).add(docIds[i]))
        } finally {
          setGapTranslatingIds((prev) => {
            const next = new Set(prev)
            next.delete(docIds[i])
            return next
          })
        }
      }
    },
    [localeParam, defaultLanguage, createMissingTranslations],
  )

  // Coverage matrix — for the gap selector view
  const coverageMatrix = useCoverageMatrix(aggregateData)

  // Active releases — for release picker
  const {releases} = useReleases()

  // Resolve locale info
  const localeInfo = useMemo(() => {
    if (!localeParam) return null
    const lang = languages.find((l) => l.id === localeParam)
    return lang ? {flag: lang.flag ?? '', name: lang.title} : {flag: '', name: localeParam}
  }, [localeParam, languages])

  // Build locale info array for gap selector
  const allLocaleInfo = useMemo(
    () =>
      languages.map((l) => ({
        flag: l.flag ?? '',
        name: l.title,
        tag: l.id,
      })),
    [languages],
  )

  // Resolve doc type label
  const docTypeLabel = typeParam
    ? documentTypeLabels[typeParam] || typeParam.charAt(0).toUpperCase() + typeParam.slice(1)
    : ''

  // Back to dashboard
  const handleBackToDashboard = () => {
    navigate('/')
  }

  return (
    <Stack className="h-full overflow-y-auto" space={5}>
      <div className="px-4 pt-4 pb-0">
        <Button
          fontSize={1}
          icon={ArrowLeftIcon}
          onClick={handleBackToDashboard}
          padding={3}
          text="Back to Dashboard"
          tone="neutral"
        />
      </div>
      <div className="dashboard-content">
        {/* Content */}
        <div className="px-4 pb-4 flex-1">
          <ErrorBoundary featureName="Translations">
            {hasGapFilter && localeInfo && gapData ? (
              <GapCloserView
                docTypeLabel={docTypeLabel}
                gapData={gapData}
                isTranslating={isBatchCreating}
                localeFlag={localeInfo.flag}
                localeName={localeInfo.name}
                onTranslateBatch={handleGapTranslateBatch}
                onTranslateSingle={handleGapTranslateSingle}
                releases={releases}
                translatedIds={gapTranslatedIds}
                translatingIds={gapTranslatingIds}
              />
            ) : hasStatusFilter ? (
              <StatusFilterView
                batchProgress={batchProgress}
                data={statusFilterResult.data}
                isBatchTranslating={isBatchTranslating}
                onBatchTranslate={batchTranslateHandler}
                releases={releases}
                status={validatedStatus}
                totalSlots={statusFilterResult.totalSlots}
              />
            ) : (
              <GapSelectorView coverageMatrix={coverageMatrix} localeInfo={allLocaleInfo} />
            )}
          </ErrorBoundary>
        </div>
      </div>
    </Stack>
  )
}

export default TranslationsRoute
