/**
 * The open localization run, as the reviewer sees it.
 *
 * Every value on this surface is workflow state read off the instance through
 * the session — stage, materiality, the analysis narrative, the per-locale
 * children, the two advisory flags. Nothing is derived from content documents,
 * and nothing is written except through a session verb.
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

import {useLocales} from '../L10nProvider'
import type {EditTarget} from './editIntent'
import {
  readFlag,
  readLocaleRequests,
  readMateriality,
  readReleaseName,
  readText,
  type Materiality,
} from './instanceFields'
import {buildLocaleRuns, liveChildInstanceIds, toChildRun, type LocaleRun} from './localeRuns'
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
  releaseName,
  onEditField,
}: {
  run: LocaleRun
  title: string
  flag: string | undefined
  documentType: string
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
          </Flex>
        )}
        {comparing && targetDocumentId && (
          <TranslationCompare
            documentId={targetDocumentId}
            documentType={documentType}
            onEditField={(fieldName) =>
              onEditField({
                documentId: targetDocumentId,
                fieldName,
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

function useLiveChildren(subworkflows: WorkflowInstance['subworkflows']) {
  const engine = useLocalizationEngine()
  // The filter object has to keep a stable identity across repaints or the
  // instance list resubscribes on every evaluation; the id set is the only
  // thing that should trigger one.
  const ids = liveChildInstanceIds(subworkflows ?? []).join(',')
  const filter = useMemo(() => ({ids: ids ? ids.split(',') : [], includeCompleted: true}), [ids])
  const {instances} = useWorkflowInstances({engine, filter})
  return instances ?? []
}

export function LocalizationRun({instanceId, documentType, onEditField}: LocalizationRunProps) {
  const engine = useLocalizationEngine()
  const session = useWorkflowSession({engine, instanceId})
  const locales = useLocales()
  const children = useLiveChildren(session.evaluation?.instance.subworkflows)

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
  const {fields, currentStage, subworkflows} = evaluation.instance
  const stage = STAGE_DISPLAY[currentStage] ?? {tone: 'default' as const, label: currentStage}
  const materiality = readMateriality(fields)
  const explanation = readText(fields, 'explanation')
  const targetLocales = readLocaleRequests(fields, 'targetLocales')
  const releaseName = readReleaseName(fields, 'release')
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

      {readFlag(fields, 'sourceChanged') && (
        <Banner icon={SyncIcon} tone="caution">
          Source changed since analysis — the translations no longer match the English they came
          from. You decide whether that matters.
        </Banner>
      )}

      {readFlag(fields, 'hasFailedLocales') && (
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
