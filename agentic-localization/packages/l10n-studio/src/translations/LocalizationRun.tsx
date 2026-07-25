/**
 * The open localization run, as the reviewer sees it.
 *
 * Every value on this surface is workflow state read off the instance through
 * the session — stage, materiality, the analysis narrative, the per-locale
 * children, the two advisory flags. Nothing is derived from content documents,
 * and nothing is written except through a session verb.
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
 * declares `editable`. Reading through it would mean opening `materiality`,
 * `explanation` and `targetLocales` to `session.editField` — turning the
 * machine's verdict into a form — to gain nothing this surface renders. The
 * reviewer's write seam is `session.fireAction`, below, and that is deliberate.
 */

import {
  CircleIcon,
  EditIcon,
  ErrorOutlineIcon,
  SparklesIcon,
  SyncIcon,
  WarningOutlineIcon,
} from '@sanity/icons'
import {Badge, Box, Button, Card, Flex, Heading, Spinner, Stack, Text} from '@sanity/ui'
import type {ActivityEvaluation, WorkflowInstance} from '@sanity/workflow-engine'
import {useWorkflowInstances, useWorkflowSession} from '@sanity/workflow-studio'
import {useMemo, useState} from 'react'

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
import {useLocales} from '../L10nProvider'
import type {EditTarget} from './editIntent'
import {ReviewActions, REVIEW_ACTIVITY} from './ReviewActions'
import {TranslationCompare} from './TranslationCompare'
import {useLocalizationEngine} from './workflowEngine'

const MATERIALITY_DISPLAY: Record<
  Materiality,
  {tone: 'default' | 'caution' | 'critical'; icon: typeof CircleIcon; label: string}
> = {
  cosmetic: {tone: 'default', icon: CircleIcon, label: 'Cosmetic'},
  minor: {tone: 'caution', icon: EditIcon, label: 'Minor Impact'},
  material: {tone: 'critical', icon: WarningOutlineIcon, label: 'Material Impact'},
}

const STAGE_DISPLAY: Record<
  string,
  {tone: 'default' | 'caution' | 'positive' | 'critical'; label: string}
> = {
  analyzing: {tone: 'default', label: 'Analyzing the source'},
  translating: {tone: 'caution', label: 'Translating'},
  review: {tone: 'caution', label: 'Ready for review'},
  approved: {tone: 'positive', label: 'Approved'},
  done: {tone: 'positive', label: 'No work needed'},
  failed: {tone: 'critical', label: 'Failed'},
}

const LOCALE_STAGE_DISPLAY: Record<
  LocaleRun['stage'],
  {tone: 'default' | 'caution' | 'positive' | 'critical'; label: string}
> = {
  queued: {tone: 'default', label: 'Queued'},
  translating: {tone: 'caution', label: 'Translating…'},
  translated: {tone: 'positive', label: 'Translated'},
  failed: {tone: 'critical', label: 'Failed'},
}

export interface LocalizationRunProps {
  instanceId: string
  /** Schema type of the translated documents, for the compare view. */
  documentType: string
  onEditField: (target: EditTarget) => void
}

function MaterialityCard({
  materiality,
  explanation,
}: {
  materiality: Materiality
  explanation: string | null
}) {
  const display = MATERIALITY_DISPLAY[materiality]
  const Icon = display.icon
  return (
    <Card border padding={4} radius={4} tone={display.tone}>
      <Stack space={4}>
        <Flex align="center" gap={3}>
          <Text size={4}>
            <Icon />
          </Text>
          <Heading size={2}>{display.label}</Heading>
        </Flex>
        {explanation && <Text size={2}>{explanation}</Text>}
      </Stack>
    </Card>
  )
}

function Banner({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof WarningOutlineIcon
  tone: 'caution' | 'critical'
  children: string
}) {
  return (
    <Card border padding={3} radius={2} tone={tone}>
      <Flex align="center" gap={2}>
        <Text size={1}>
          <Icon />
        </Text>
        <Text size={1}>{children}</Text>
      </Flex>
    </Card>
  )
}

function LocaleRunRow({
  run,
  title,
  flag,
  documentType,
  fieldTier,
  releaseName,
  onEditField,
}: {
  run: LocaleRun
  title: string
  flag: string | undefined
  documentType: string
  /** The locale's translation lives in the subject rather than a document of its own. */
  fieldTier: boolean
  releaseName: string | null
  onEditField: (target: EditTarget) => void
}) {
  const [comparing, setComparing] = useState(false)
  const display = LOCALE_STAGE_DISPLAY[run.stage]
  const {targetDocumentId} = run

  return (
    <Card border padding={3} radius={2}>
      <Stack space={3}>
        <Flex align="center" gap={3}>
          {flag && <Text size={3}>{flag}</Text>}
          <Stack space={2}>
            <Text size={1} weight="medium">
              {title}
            </Text>
            <Text muted size={0}>
              {run.locale}
              {run.reason ? ` — ${run.reason}` : ''}
            </Text>
          </Stack>
          <Box flex={1} />
          {run.progress !== null && run.stage === 'translating' && (
            <Text muted size={0}>
              {Math.round(run.progress)}%
            </Text>
          )}
          <Badge fontSize={0} mode="outline" tone={display.tone}>
            {display.label}
          </Badge>
        </Flex>
        {targetDocumentId && (
          <Flex gap={2}>
            <Button
              fontSize={0}
              mode="bleed"
              onClick={() => setComparing((open) => !open)}
              padding={2}
              text={comparing ? 'Hide compare' : 'Compare with published'}
            />
            {!fieldTier && (
              <Button
                fontSize={0}
                icon={EditIcon}
                mode="bleed"
                onClick={() =>
                  onEditField({
                    documentId: targetDocumentId,
                    releaseName: releaseName ?? undefined,
                  })
                }
                padding={2}
                text="Open translation"
              />
            )}
          </Flex>
        )}
        {comparing && targetDocumentId && (
          <TranslationCompare
            documentId={targetDocumentId}
            documentType={documentType}
            locale={fieldTier ? run.locale : undefined}
            onEditField={(fieldPath) =>
              onEditField({
                documentId: targetDocumentId,
                fieldName: fieldPath,
                releaseName: releaseName ?? undefined,
              })
            }
            releaseName={releaseName ?? undefined}
          />
        )}
      </Stack>
    </Card>
  )
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

export function LocalizationRun({instanceId, documentType, onEditField}: LocalizationRunProps) {
  const engine = useLocalizationEngine()
  const session = useWorkflowSession({engine, instanceId})
  const locales = useLocales()
  const children = useChildren(session.evaluation?.instance.subworkflows)

  if (session.invalid) {
    return (
      <Card border padding={4} radius={2} tone="critical">
        <Stack space={3}>
          <Text size={1} weight="medium">
            This run cannot be read
          </Text>
          <Text muted size={1}>
            {session.invalid.reason === 'model-ahead'
              ? 'The run was written by a newer engine than this Studio. Upgrade the @sanity/workflow-* packages.'
              : 'The instance document does not match the shape the engine expects.'}
          </Text>
        </Stack>
      </Card>
    )
  }

  if (!session.ready || !session.evaluation) {
    return (
      <Flex align="center" gap={2} padding={4}>
        <Spinner muted />
        <Text muted size={1}>
          Loading the localization run…
        </Text>
      </Flex>
    )
  }

  const {evaluation} = session
  const {instance} = evaluation
  const {currentStage, subworkflows, perspective} = instance
  const stage = STAGE_DISPLAY[currentStage] ?? {tone: 'default' as const, label: currentStage}
  const fieldTier = isFieldTier(documentType)
  // A field-tier run writes its translations into the subject, so it can only
  // tell a source edit from its own output when it reads the published layer.
  // The Studio's own Start action has no perspective hook (see the migration
  // notes), so a run started from the picker carries the drafts default and
  // reports itself as drift. Say so rather than let the flag lie.
  const driftUnreliable = fieldTier && perspective !== 'published'
  const materiality = readMateriality(instance)
  const explanation = readText(instance, 'explanation')
  const targetLocales = readLocaleRequests(instance, 'targetLocales')
  const releaseName = readReleaseName(instance, 'release')
  const runs = buildLocaleRuns({
    targetLocales,
    subworkflows: subworkflows ?? [],
    children: children.map(toChildRun),
  })
  const failedCount = runs.filter((run) => run.stage === 'failed').length

  const reviewActivity: ActivityEvaluation | undefined = evaluation.currentStage.activities.find(
    (activity) => activity.activity.name === REVIEW_ACTIVITY && !activity.scopedOut,
  )

  return (
    <Stack space={4}>
      <Flex align="center" gap={2}>
        <Text size={1}>
          <SparklesIcon />
        </Text>
        <Text size={1} weight="medium">
          {stage.label}
        </Text>
        <Box flex={1} />
        {releaseName && (
          <Badge fontSize={0} mode="outline">
            {releaseName}
          </Badge>
        )}
      </Flex>

      {materiality && <MaterialityCard explanation={explanation} materiality={materiality} />}

      {readFlag(instance, 'sourceChanged') && (
        <Banner icon={SyncIcon} tone="caution">
          {driftUnreliable
            ? 'The source revision moved while this run was open — but this run reads drafts, so its own translations moved it too. Check the source yourself; runs started from a publish read the published layer and can tell the difference.'
            : 'Source changed since analysis — the translations no longer match the English they came from. You decide whether that matters.'}
        </Banner>
      )}

      {readFlag(instance, 'hasFailedLocales') && (
        <Banner icon={ErrorOutlineIcon} tone="critical">
          {`${failedCount || 'Some'} locale${failedCount === 1 ? '' : 's'} failed to translate. Shipping the rest is your call.`}
        </Banner>
      )}

      {runs.length === 0 ? (
        <Card border padding={3} radius={2} tone="transparent">
          <Text align="center" muted size={1}>
            No locale needed work for this change.
          </Text>
        </Card>
      ) : (
        <Stack space={2}>
          {runs.map((run) => {
            const locale = locales?.find((candidate) => candidate.id === run.locale)
            return (
              <LocaleRunRow
                documentType={documentType}
                fieldTier={fieldTier}
                flag={locale?.flag}
                key={run.locale}
                onEditField={onEditField}
                releaseName={releaseName}
                run={run}
                title={locale?.title ?? run.locale}
              />
            )
          })}
        </Stack>
      )}

      {reviewActivity && (
        <ReviewActions
          activity={reviewActivity}
          locales={runs.map((run) => run.locale)}
          onFire={({action, params}) =>
            session.fireAction({activity: REVIEW_ACTIVITY, action, params})
          }
        />
      )}
    </Stack>
  )
}
