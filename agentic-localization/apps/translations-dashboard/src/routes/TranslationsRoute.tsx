/**
 * Translations route — the "act" mode.
 *
 * 1. `?type=&locale=` → GapCloserView, one gap at a time.
 * 2. `?status=`       → StatusFilterView, the drill-down from a status card.
 * 3. no params        → GapSelectorView, "choose a gap to close".
 *
 * Acting means starting a run: one `localize-document` per document when the
 * batch ships as drafts, one `localize-campaign` when it ships as a release.
 * Everything after that belongs to the engine.
 */

import {ArrowLeftIcon} from '@sanity/icons'
import {Button, Stack, useToast} from '@sanity/ui'
import {useCallback, useMemo, useState, useTransition} from 'react'
import {useNavigate, useSearchParams} from 'react-router-dom'

import type {DashboardStatus} from '../lib/localizationRun'
import type {CampaignTarget, LocalizationTarget, StartReport} from '../hooks/useStartLocalization'

import {documentTypeLabels} from '../consts/documentInternationalization'
import DuplicateRunDialog from '../components/DuplicateRunDialog'
import ErrorBoundary from '../components/ErrorBoundary'
import GapCloserView from '../components/GapCloserView'
import GapSelectorView from '../components/GapSelectorView'
import StatusFilterView from '../components/StatusFilterView'
import {useCoverageMatrix} from '../hooks/useCoverageMatrix'
import {useGapDocuments} from '../hooks/useGapDocuments'
import {useReleases} from '../hooks/useReleases'
import {useStartLocalization} from '../hooks/useStartLocalization'
import {useStatusFilteredDocuments} from '../hooks/useStatusFilteredDocuments'
import {useTranslationAggregateData} from '../hooks/useTranslationAggregateData'
import {useTranslationConfig} from '../contexts/TranslationConfigContext'

/** Valid statuses for the ?status= param */
const VALID_STATUSES = new Set<string>([
  'approved',
  'missing',
  'needsReview',
  'stale',
  'translating',
  'usingFallback',
])

function isDashboardStatus(value: null | string): value is DashboardStatus {
  return value !== null && VALID_STATUSES.has(value)
}

/** A batch waiting on the operator's answer to the duplicate-run pre-check. */
interface PendingBatch {
  running: Set<string>
  target: CampaignTarget
  targets: LocalizationTarget[]
}

function summarise(report: StartReport): string {
  const parts: string[] = []
  if (report.campaignInstanceId) parts.push(`Campaign started for ${report.started.length}`)
  else if (report.started.length > 0) parts.push(`Started ${report.started.length}`)
  if (report.alreadyRunning.length > 0) {
    parts.push(`${report.alreadyRunning.length} already running (advanced)`)
  }
  if (report.failed.length > 0) parts.push(`${report.failed.length} failed`)
  return parts.join(' · ') || 'Nothing to start'
}

function TranslationsRoute() {
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const {languages} = useTranslationConfig()

  const typeParam = searchParams.get('type')
  const localeParam = searchParams.get('locale')
  const statusParam = searchParams.get('status')
  const validatedStatus = isDashboardStatus(statusParam) ? statusParam : null

  const hasGapFilter = typeParam !== null && localeParam !== null
  const hasStatusFilter = validatedStatus !== null

  const {data: aggregateData} = useTranslationAggregateData()
  const gapData = useGapDocuments(aggregateData, typeParam, localeParam)
  const statusFilterResult = useStatusFilteredDocuments(
    aggregateData,
    validatedStatus,
    localeParam,
    typeParam,
  )
  const coverageMatrix = useCoverageMatrix(aggregateData)
  const {releases} = useReleases()

  const {findRunning, startBatch} = useStartLocalization()
  const [isStarting, startTransition] = useTransition()
  const [pendingBatch, setPendingBatch] = useState<null | PendingBatch>(null)

  const run = useCallback(
    (targets: LocalizationTarget[], target: CampaignTarget) => {
      startTransition(async () => {
        const report = await startBatch(targets, target)
        toast.push({
          status: report.failed.length > 0 ? 'warning' : 'success',
          title: summarise(report),
        })
        if (report.campaignInstanceId) navigate(`/runs/${report.campaignInstanceId}`)
      })
    },
    [navigate, startBatch, toast],
  )

  /**
   * The pre-check: ask the engine which of these already have an open run
   * before starting anything, and let the operator decide. A start requirement
   * would fail the whole batch because one document is busy.
   */
  const requestStart = useCallback(
    (targets: LocalizationTarget[], target: CampaignTarget) => {
      startTransition(async () => {
        const running = await findRunning(targets)
        if (running.size === 0) {
          run(targets, target)
          return
        }
        setPendingBatch({running, target, targets})
      })
    },
    [findRunning, run],
  )

  const handleSkip = useCallback(() => {
    if (!pendingBatch) return
    const {running, target, targets} = pendingBatch
    setPendingBatch(null)
    run(
      targets.filter((doc) => !running.has(doc._id)),
      target,
    )
  }, [pendingBatch, run])

  const handleTakeOver = useCallback(() => {
    if (!pendingBatch) return
    const {target, targets} = pendingBatch
    setPendingBatch(null)
    run(targets, target)
  }, [pendingBatch, run])

  const statusTargets = useMemo(
    (): LocalizationTarget[] =>
      statusFilterResult.data.map((doc) => ({_id: doc._id, _rev: doc._rev, _type: doc._type})),
    [statusFilterResult.data],
  )

  const gapTargets = useMemo(
    (): LocalizationTarget[] =>
      (gapData?.documents ?? []).map((doc) => ({
        _id: doc.documentId,
        _rev: doc.documentRev,
        _type: doc.documentType,
      })),
    [gapData],
  )

  const localeInfo = useMemo(() => {
    if (!localeParam) return null
    const lang = languages.find((l) => l.id === localeParam)
    return lang ? {flag: lang.flag ?? '', name: lang.title} : {flag: '', name: localeParam}
  }, [localeParam, languages])

  const allLocaleInfo = useMemo(
    () => languages.map((l) => ({flag: l.flag ?? '', name: l.title, tag: l.id})),
    [languages],
  )

  const docTypeLabel = typeParam
    ? documentTypeLabels[typeParam] || typeParam.charAt(0).toUpperCase() + typeParam.slice(1)
    : ''

  return (
    <Stack className="h-full overflow-y-auto" space={5}>
      <div className="px-4 pt-4 pb-0">
        <Button
          fontSize={1}
          icon={ArrowLeftIcon}
          onClick={() => navigate('/')}
          padding={3}
          text="Back to Dashboard"
          tone="neutral"
        />
      </div>
      <div className="dashboard-content">
        <div className="px-4 pb-4 flex-1">
          <ErrorBoundary featureName="Translations">
            {hasGapFilter && localeInfo && gapData ? (
              <GapCloserView
                docTypeLabel={docTypeLabel}
                gapData={gapData}
                isStarting={isStarting}
                localeFlag={localeInfo.flag}
                localeName={localeInfo.name}
                onStart={(target) => requestStart(gapTargets, target)}
                onStartOne={(doc, target) =>
                  requestStart(
                    [{_id: doc.documentId, _rev: doc.documentRev, _type: doc.documentType}],
                    target,
                  )
                }
                releases={releases}
              />
            ) : hasStatusFilter ? (
              <StatusFilterView
                data={statusFilterResult.data}
                isStarting={isStarting}
                onStart={(target) => requestStart(statusTargets, target)}
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
      {pendingBatch && (
        <DuplicateRunDialog
          onCancel={() => setPendingBatch(null)}
          onSkip={handleSkip}
          onTakeOver={handleTakeOver}
          runningCount={pendingBatch.running.size}
          totalCount={pendingBatch.targets.length}
        />
      )}
    </Stack>
  )
}

export default TranslationsRoute
