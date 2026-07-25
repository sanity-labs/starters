/**
 * The localization run, as the reviewer sees it: a locale × field grid over the
 * diff it selects.
 *
 * The grid sits where Studio's own `ChangesInspector` puts its `TimelineMenu` —
 * a fixed compare-scope selector above a scrolling change list — and answers the
 * one question a reviewer arrives with: where do I actually have to look. Every
 * value on this surface is workflow state read off the instance through the
 * session; nothing is derived from content documents except the diffs
 * themselves, and nothing is written except through a session verb.
 *
 * The reads hand `evaluation.instance` to `@starter/l10n`'s readers rather than
 * its bare `fields[]`, so the engine's own `resolveFieldEntry` owns scope
 * resolution — a workflow-scope field resolves at workflow scope even if a stage
 * ever declares the same name.
 *
 * Not the official recipes' `EditableFieldEvaluation` off
 * `evaluation.editableFields`, which is the surface a field a person edits should
 * use. The engine builds that list from `fieldSites(...).filter(site =>
 * site.entry.editable !== undefined)`, so it is empty for `localize-document`:
 * every field here is written by an effect's completion or a transition, and none
 * declares `editable`. The reviewer's write seam is `session.fireAction`, and
 * that is deliberate.
 */

import {Box, Button, Card, Flex, Spinner, Text} from '@sanity/ui'
import type {ActivityEvaluation, WorkflowInstance} from '@sanity/workflow-engine'
import {
  useWorkflowInstances,
  useWorkflowSession,
  type WorkflowSession,
} from '@sanity/workflow-studio'
import {useMemo, useState} from 'react'
import {useTranslation} from 'sanity'
import {useDocumentTitle} from 'sanity/structure'

import {
  buildLocaleRuns,
  childInstanceIds,
  isFieldTier,
  readFlag,
  readLocaleRequests,
  readMateriality,
  readReleaseName,
  readText,
  toChildRun,
  type LocaleRun,
  type Materiality,
} from '@starter/l10n'
import {l10nLocaleNamespace} from '../i18n'
import {useLocales, type Locale} from '../L10nProvider'
import {defaultSelection} from './gridModel'
import {InspectorFrame} from './InspectorFrame'
import {
  CellLegend,
  GRID_COLUMN_LIMIT,
  LocaleFieldGrid,
  useAbsorbed,
  type GridPresentation,
} from './LocaleFieldGrid'
import {MatrixDetail} from './MatrixDetail'
import {MatrixFooter} from './MatrixFooter'
import {useFocusFieldInPane, useOpenSiblingPane} from './paneNavigation'
import {REVIEW_ACTIVITY} from './ReviewActions'
import {useDocumentTierGrid, useFieldTierGrid, type TranslationGrid} from './useTranslationGrid'
import {useLocalizationEngine, useLocalizationInstance} from './workflowEngine'

export interface ReviewMatrixProps {
  documentId: string
  documentType: string
  /** The source language; every other configured locale becomes a row. */
  defaultLanguage: string | undefined
  onClose?: () => void
  onOpenMetadata?: (documentId: string) => void
}

/** Everything the footer and the grid read off the open run. */
interface RunState {
  runs: readonly LocaleRun[]
  materiality: Materiality | null
  explanation: string | null
  sourceChanged: boolean
  driftUnreliable: boolean
  failedCount: number
  releaseName: string | null
  stage: string
  reviewActivity: ActivityEvaluation | undefined
}

function useChildren(subworkflows: WorkflowInstance['subworkflows']) {
  const engine = useLocalizationEngine()
  // The filter object has to keep a stable identity across repaints or the
  // instance list resubscribes on every evaluation; the id set is the only
  // thing that should trigger one. `includeCompleted` is what makes the rows
  // still carry a `target` once every locale has finished — which is when a
  // reviewer actually looks at them.
  const ids = childInstanceIds(subworkflows ?? []).join(',')
  const filter = useMemo(() => ({ids: ids ? ids.split(',') : [], includeCompleted: true}), [ids])
  const {instances} = useWorkflowInstances({engine, filter})
  return instances ?? []
}

const NO_RUN: RunState = {
  runs: [],
  materiality: null,
  explanation: null,
  sourceChanged: false,
  driftUnreliable: false,
  failedCount: 0,
  releaseName: null,
  stage: '',
  reviewActivity: undefined,
}

function useRunState(
  session: WorkflowSession | null,
  children: readonly WorkflowInstance[],
  documentType: string,
): RunState {
  return useMemo(() => {
    const evaluation = session?.evaluation
    if (!evaluation) return NO_RUN

    const {instance} = evaluation
    const runs = buildLocaleRuns({
      targetLocales: readLocaleRequests(instance, 'targetLocales'),
      subworkflows: instance.subworkflows ?? [],
      children: children.map(toChildRun),
    })

    return {
      runs,
      materiality: readMateriality(instance),
      explanation: readText(instance, 'explanation'),
      sourceChanged: readFlag(instance, 'sourceChanged'),
      // A field-tier run writes its translations into the subject, so it can
      // only tell a source edit from its own output when it reads the published
      // layer. A run started from the Studio's own Start action carries the
      // drafts default and reports itself as drift. Say so rather than let the
      // flag lie.
      driftUnreliable: isFieldTier(documentType) && instance.perspective !== 'published',
      failedCount: runs.filter((run) => run.stage === 'failed').length,
      releaseName: readReleaseName(instance, 'release'),
      stage: instance.currentStage,
      reviewActivity: evaluation.currentStage.activities.find(
        (activity) => activity.activity.name === REVIEW_ACTIVITY && !activity.scopedOut,
      ),
    }
  }, [session?.evaluation, children, documentType])
}

function useTargetLocales(defaultLanguage: string | undefined): {
  locales: readonly Locale[]
  ids: readonly string[]
} {
  const locales = useLocales()
  return useMemo(() => {
    const targets = (locales ?? []).filter((locale) => locale.id !== defaultLanguage)
    return {locales: locales ?? [], ids: targets.map((locale) => locale.id)}
  }, [locales, defaultLanguage])
}

/**
 * What the engine has to say right now, if it is not the run itself. The grid
 * below is derived from content, so it renders either way — coverage is a fact
 * about the documents, not about whether a run happens to be open.
 */
type RunNotice = 'checking' | 'loading' | 'none' | 'unreachable' | 'unreadable' | null

export function ReviewMatrix(props: ReviewMatrixProps) {
  const {instanceId, loading, error} = useLocalizationInstance(props.documentId)

  if (instanceId) return <RunMatrix {...props} instanceId={instanceId} />
  return (
    <TierMatrix
      {...props}
      childInstances={EMPTY_CHILDREN}
      notice={loading ? 'checking' : error ? 'unreachable' : 'none'}
      session={null}
    />
  )
}

const EMPTY_CHILDREN: readonly WorkflowInstance[] = []

function RunMatrix({instanceId, ...props}: ReviewMatrixProps & {instanceId: string}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const engine = useLocalizationEngine()
  const session = useWorkflowSession({engine, instanceId})
  const children = useChildren(session.evaluation?.instance.subworkflows)

  const notice: RunNotice = session.invalid
    ? 'unreadable'
    : session.error
      ? 'unreachable'
      : session.ready && session.evaluation
        ? null
        : 'loading'

  // The remediation differs and matters: upgrade the engine for `model-ahead`,
  // investigate the document for a shape violation, chase the network for a
  // failed stream. The pinned bar only has room for the verdict.
  const noticeDetail = session.invalid
    ? session.invalid.reason === 'model-ahead'
      ? t('matrix.run.model-ahead')
      : t('matrix.run.malformed')
    : session.error
      ? session.error instanceof Error
        ? session.error.message
        : String(session.error)
      : null

  return (
    <TierMatrix
      {...props}
      childInstances={children}
      notice={notice}
      noticeDetail={noticeDetail}
      session={session}
    />
  )
}

interface TierMatrixProps extends ReviewMatrixProps {
  session: WorkflowSession | null
  childInstances: readonly WorkflowInstance[]
  notice: RunNotice
  noticeDetail?: string | null
}

function TierMatrix(props: TierMatrixProps) {
  return isFieldTier(props.documentType) ? (
    <FieldTierMatrix {...props} />
  ) : (
    <DocumentTierMatrix {...props} />
  )
}

function DocumentTierMatrix({
  session,
  childInstances,
  notice,
  noticeDetail,
  ...props
}: TierMatrixProps) {
  const {documentId, documentType, defaultLanguage} = props
  const run = useRunState(session, childInstances, documentType)
  const {locales, ids} = useTargetLocales(defaultLanguage)
  const releaseName = run.releaseName ?? undefined
  const grid = useDocumentTierGrid({
    documentId,
    documentType,
    targetLocales: ids,
    runs: run.runs,
    releaseName,
  })
  const openSibling = useOpenSiblingPane()

  const open = (locale: string, fieldName?: string) => {
    const target = grid.documentIdByLocale.get(locale)
    if (target) openSibling({documentId: target, documentType, fieldName, releaseName})
  }

  return (
    <MatrixLayout
      {...props}
      canOpenLocale={(locale) => grid.documentIdByLocale.has(locale)}
      grid={grid}
      locales={locales}
      metadataId={grid.metadataId}
      notice={notice}
      noticeDetail={noticeDetail}
      onEditField={(locale, editPath) => open(locale, editPath)}
      onOpenLocale={(locale) => open(locale)}
      run={run}
      session={session}
    />
  )
}

function FieldTierMatrix({
  session,
  childInstances,
  notice,
  noticeDetail,
  ...props
}: TierMatrixProps) {
  const {documentId, documentType, defaultLanguage} = props
  const run = useRunState(session, childInstances, documentType)
  const {locales, ids} = useTargetLocales(defaultLanguage)
  const grid = useFieldTierGrid({
    documentId,
    documentType,
    targetLocales: ids,
    runs: run.runs,
    releaseName: run.releaseName ?? undefined,
  })
  const focusField = useFocusFieldInPane()

  return (
    <MatrixLayout
      {...props}
      canOpenLocale={(locale) => grid.anchors.has(locale)}
      grid={grid}
      locales={locales}
      metadataId={null}
      notice={notice}
      noticeDetail={noticeDetail}
      onEditField={(_locale, editPath) => focusField(editPath)}
      onOpenLocale={(locale) => {
        const anchor = grid.anchors.get(locale)
        if (anchor) focusField(anchor)
      }}
      run={run}
      session={session}
    />
  )
}

interface MatrixLayoutProps extends ReviewMatrixProps {
  session: WorkflowSession | null
  run: RunState
  grid: TranslationGrid
  locales: readonly Locale[]
  metadataId: string | null
  notice: RunNotice
  noticeDetail?: string | null
  onOpenLocale: (locale: string) => void
  canOpenLocale: (locale: string) => boolean
  onEditField: (locale: string, editPath: string) => void
}

function MatrixLayout({
  session,
  run,
  grid,
  locales,
  metadataId,
  notice,
  noticeDetail,
  onOpenLocale,
  canOpenLocale,
  onEditField,
  onClose,
  onOpenMetadata,
}: MatrixLayoutProps) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const {title} = useDocumentTitle()
  const [selection, setSelection] = useState<{locale: string; field: string | null} | null>(null)
  // The escape hatch is explicit, never a breakpoint: a run that moved six or
  // more fields cannot fit its columns in 296px, so the reviewer is offered the
  // locale list instead of having the layout change under them on resize.
  const [presentation, setPresentation] = useState<GridPresentation | null>(null)
  // The grid's `↻` and the footer's own verb open the same dialog; the state it
  // opens with is the locale list, which is why it lives above both.
  const [requestChangesFor, setRequestChangesFor] = useState<readonly string[] | null>(null)
  const [sentinelRef, absorbed] = useAbsorbed()

  const {model} = grid
  const locale = selection?.locale ?? defaultSelection(model)
  const row = model.rows.find((candidate) => candidate.locale === locale)
  const resolvedPresentation =
    presentation ?? (model.columns.length >= GRID_COLUMN_LIMIT ? 'rows' : 'grid')

  if (model.rows.length === 0) {
    return (
      <InspectorFrame metadataId={metadataId} onClose={onClose} onOpenMetadata={onOpenMetadata}>
        <Box padding={3}>
          <Card border padding={3} radius={2} tone="transparent">
            <Text align="center" muted size={1}>
              {t('translations.no-locales')}
            </Text>
          </Card>
        </Box>
      </InspectorFrame>
    )
  }

  return (
    <InspectorFrame metadataId={metadataId} onClose={onClose} onOpenMetadata={onOpenMetadata}>
      <div ref={sentinelRef} />
      <Card borderBottom style={{position: 'sticky', top: 0, zIndex: 2}}>
        <StickyIdentity notice={notice} stage={run.stage} title={absorbed ? title : undefined} />
        {model.columns.length >= GRID_COLUMN_LIMIT && (
          <PresentationToggle onChange={setPresentation} value={resolvedPresentation} />
        )}
        <LocaleFieldGrid
          canOpen={canOpenLocale}
          locales={locales}
          model={model}
          onOpen={onOpenLocale}
          onRetry={(target) => setRequestChangesFor([target])}
          onSelect={(nextLocale, field) => setSelection({locale: nextLocale, field})}
          presentation={resolvedPresentation}
          selectedField={selection?.field ?? null}
          selectedLocale={locale}
        />
      </Card>

      <CellLegend />

      {noticeDetail && (
        <Box paddingX={3} paddingBottom={3}>
          <Card border padding={3} radius={2} tone="caution">
            <Text size={1}>{noticeDetail}</Text>
          </Card>
        </Box>
      )}

      {locale && row && (
        <MatrixDetail
          failed={row.state === 'failed'}
          fields={grid.detail.get(locale) ?? []}
          focusField={selection?.field ?? null}
          locale={locale}
          localeTitle={locales.find((candidate) => candidate.id === locale)?.title ?? locale}
          missing={row.state === 'missing'}
          onEditField={(editPath) => onEditField(locale, editPath)}
          onOpenDocument={row.state === 'ok' ? () => onOpenLocale(locale) : null}
        />
      )}

      <MatrixFooter
        activity={run.reviewActivity}
        driftUnreliable={run.driftUnreliable}
        explanation={run.explanation}
        failedCount={run.failedCount}
        locales={run.runs.map((entry) => entry.locale)}
        materiality={run.materiality}
        onFire={({action, params}) =>
          session
            ? session.fireAction({activity: REVIEW_ACTIVITY, action, params})
            : Promise.resolve()
        }
        onRequestChangesFor={setRequestChangesFor}
        requestChangesFor={requestChangesFor}
        sourceChanged={run.sourceChanged}
      />
    </InspectorFrame>
  )
}

/**
 * The one line the pinned bar keeps: which run this is, over which document.
 * It is what the frame's title row hands over once that row has scrolled past.
 */
function StickyIdentity({
  stage,
  title,
  notice,
}: {
  stage: string
  title: string | undefined
  notice: RunNotice
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const label = notice
    ? t(`matrix.run.${notice}`)
    : t(`matrix.stage.${stage}`, {defaultValue: stage})

  return (
    <Flex align="center" gap={2} paddingLeft={3} paddingRight={2} paddingY={1}>
      {notice === 'checking' || notice === 'loading' ? <Spinner muted size={0} /> : null}
      <Text muted size={0} textOverflow="ellipsis" weight="medium">
        {title ? t('matrix.identity', {stage: label, title}) : label}
      </Text>
    </Flex>
  )
}

function PresentationToggle({
  value,
  onChange,
}: {
  value: GridPresentation
  onChange: (next: GridPresentation) => void
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  return (
    <Flex align="center" gap={1} paddingX={2}>
      <Text muted size={0}>
        {t('matrix.presentation.label')}
      </Text>
      <Box flex={1} />
      {(['rows', 'grid'] as const).map((option) => (
        <Button
          fontSize={0}
          key={option}
          mode={value === option ? 'default' : 'bleed'}
          onClick={() => onChange(option)}
          padding={1}
          text={t(`matrix.presentation.${option}`)}
        />
      ))}
    </Flex>
  )
}
