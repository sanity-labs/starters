/**
 * One workflow run, campaign or document.
 *
 * Everything here is a read of the engine's own projection plus the two verbs a
 * surface is allowed: `fireAction` for what the evaluation says is allowed, and
 * `tick` to let the instance re-observe its watch-set (which is what makes
 * `sourceChanged` visible). No stage names are hardcoded — the definition and
 * the evaluation carry the vocabulary.
 */

import {ArrowLeftIcon, WarningOutlineIcon} from '@sanity/icons'
import {Badge, Box, Button, Card, Flex, Heading, Spinner, Stack, Text, TextInput} from '@sanity/ui'
import {WorkflowDiagram} from '@sanity/workflow-diagram'
import {childInstanceIds} from '@starter/l10n'
import {useWorkflowInstances, useWorkflowSession} from '@sanity/workflow-sdk'
import {extractDocumentId, toBareId} from '@sanity/workflow-engine'
import {useMemo, useState, useTransition} from 'react'
import {useNavigate, useParams} from 'react-router-dom'

import type {ActionEvaluation, WorkflowEvaluation} from '@sanity/workflow-engine'

import ErrorBoundary from '../components/ErrorBoundary'
import {useL10nEngine} from '../hooks/useL10nEngine'

/** Stage names that mean "this one did not make it". Surfaced, never blocking. */
const FAILED_STAGES = new Set(['failed'])

interface ChildRow {
  instanceId: string
  /** Locale for a document run, document id for a campaign. */
  label: string
  stage: string
}

function stageTone(stage: string): 'caution' | 'critical' | 'default' | 'positive' {
  if (FAILED_STAGES.has(stage)) return 'critical'
  if (stage === 'approved' || stage === 'published' || stage === 'translated' || stage === 'done') {
    return 'positive'
  }
  if (stage === 'review' || stage === 'ready') return 'caution'
  return 'default'
}

function ChildrenTable({rows}: {rows: ChildRow[]}) {
  const navigate = useNavigate()
  if (rows.length === 0) return null

  return (
    <Stack space={2}>
      <Text className="uppercase tracking-widest" muted size={0} weight="semibold">
        Child runs
      </Text>
      <Card border radius={2}>
        <Stack space={0}>
          {rows.map((row) => (
            <Flex
              align="center"
              className="border-b border-black/[0.06]"
              gap={3}
              key={row.instanceId}
              padding={3}
            >
              <Box flex={1}>
                <Text size={1} weight="medium">
                  {row.label}
                </Text>
              </Box>
              <Badge fontSize={1} padding={2} tone={stageTone(row.stage)}>
                {row.stage}
              </Badge>
              <Button
                fontSize={1}
                mode="bleed"
                onClick={() => navigate(`/runs/${row.instanceId}`)}
                padding={2}
                text="Open"
              />
            </Flex>
          ))}
        </Stack>
      </Card>
    </Stack>
  )
}

interface ActionButtonProps {
  activity: string
  evaluation: ActionEvaluation
  onFire: (params?: Record<string, unknown>) => void
  pending: boolean
}

/**
 * Param-less actions fire straight; the campaign's `schedule` takes a single
 * datetime, which is worth the input. Anything asking for more (a review's
 * `request-changes` needs a note and a locale list) belongs in Studio, where
 * the content is.
 */
function ActionButton({activity, evaluation, onFire, pending}: ActionButtonProps) {
  const {action, allowed, disabledReason} = evaluation
  const params = action.params ?? []
  const [dateTime, setDateTime] = useState('')

  const label = action.title || action.name

  if (params.length === 0) {
    return (
      <Button
        disabled={!allowed || pending}
        fontSize={1}
        onClick={() => onFire()}
        padding={3}
        text={label}
        title={allowed ? action.description : disabledReason?.kind}
        tone="primary"
      />
    )
  }

  const onlyDateTime = params.length === 1 && params[0].type === 'dateTime'
  if (!onlyDateTime) {
    return (
      <Button
        disabled
        fontSize={1}
        padding={3}
        text={`${label} — open in Studio`}
        title="This action needs input the dashboard does not collect"
      />
    )
  }

  return (
    <Flex align="flex-end" gap={2} key={`${activity}.${action.name}`}>
      <TextInput
        aria-label={params[0].title || params[0].name}
        fontSize={1}
        onChange={(event) => setDateTime(event.currentTarget.value)}
        padding={3}
        type="datetime-local"
        value={dateTime}
      />
      <Button
        disabled={!allowed || pending || dateTime === ''}
        fontSize={1}
        onClick={() => onFire({[params[0].name]: new Date(dateTime).toISOString()})}
        padding={3}
        text={label}
        tone="primary"
      />
    </Flex>
  )
}

function RunDetail({instanceId}: {instanceId: string}) {
  const navigate = useNavigate()
  const engine = useL10nEngine()
  const {error, evaluation, fireAction, invalid, ready, tick} = useWorkflowSession({
    engine,
    instanceId,
  })
  const [pending, startTransition] = useTransition()

  const subworkflows = useMemo(
    () => evaluation?.instance.subworkflows ?? [],
    [evaluation?.instance.subworkflows],
  )
  const childIds = useMemo(() => childInstanceIds(subworkflows), [subworkflows])
  const {instances: children} = useWorkflowInstances({engine, filter: {ids: childIds}})

  const rows = useMemo((): ChildRow[] => {
    const liveStage = new Map((children ?? []).map((child) => [child._id, child.currentStage]))
    // Rows accumulate across stage visits; the newest row per key is the current attempt.
    const newest = new Map<string, (typeof subworkflows)[number]>()
    for (const row of subworkflows) {
      const held = newest.get(row.rowKey)
      if (!held || held.spawnedAt <= row.spawnedAt) newest.set(row.rowKey, row)
    }

    return [...newest.values()].map((row): ChildRow => {
      const childId = extractDocumentId(row.ref.id)
      return {
        instanceId: childId,
        // A locale key passes through; a document GDR resolves to its id.
        label: toBareId(row.rowKey),
        // A cohort's `status` only says the child settled — its stage says how.
        stage: row.resolved?.stage ?? liveStage.get(childId) ?? 'running',
      }
    })
  }, [subworkflows, children])

  if (invalid) {
    return (
      <Card padding={4} radius={2} tone="critical">
        <Text size={1}>{invalid.message}</Text>
      </Card>
    )
  }

  if (error) {
    return (
      <Card padding={4} radius={2} tone="critical">
        <Text size={1}>Could not read this run.</Text>
      </Card>
    )
  }

  if (!ready || !evaluation) {
    return (
      <Flex justify="center" padding={5}>
        <Spinner muted />
      </Flex>
    )
  }

  const {definition, instance} = evaluation
  const failedChildren = rows.filter((row) => FAILED_STAGES.has(row.stage))

  return (
    <Stack space={4}>
      <Flex align="center" gap={3}>
        <Box flex={1}>
          <Heading size={2}>{definition.title}</Heading>
        </Box>
        <Badge fontSize={1} padding={2} tone={stageTone(instance.currentStage)}>
          {instance.currentStage}
        </Badge>
        <Button
          disabled={pending}
          fontSize={1}
          mode="ghost"
          onClick={() => startTransition(async () => void (await tick()))}
          padding={3}
          text="Check for changes"
        />
      </Flex>

      {/* Partial failure is surfaced, never blocking — shipping the rest is a decision. */}
      {failedChildren.length > 0 && (
        <Card padding={3} radius={2} tone="caution">
          <Flex align="center" gap={2}>
            <Text size={1}>
              <WarningOutlineIcon />
            </Text>
            <Text size={1}>
              {failedChildren.length} child run{failedChildren.length === 1 ? '' : 's'} failed:{' '}
              {failedChildren.map((row) => row.label).join(', ')}
            </Text>
          </Flex>
        </Card>
      )}

      <Card border radius={2}>
        <WorkflowDiagram
          currentStage={instance.currentStage}
          definition={definition}
          height={260}
          history={instance.history}
          key={instanceId}
        />
      </Card>

      <RunActions evaluation={evaluation} fireAction={fireAction} />

      <ChildrenTable rows={rows} />

      <Button
        fontSize={1}
        icon={ArrowLeftIcon}
        mode="bleed"
        onClick={() => navigate('/translations')}
        padding={3}
        text="Back to Translations"
      />
    </Stack>
  )
}

function RunActions({
  evaluation,
  fireAction,
}: {
  evaluation: WorkflowEvaluation
  fireAction: (args: {
    action: string
    activity: string
    params?: Record<string, unknown>
  }) => Promise<unknown>
}) {
  const [pending, startTransition] = useTransition()

  // Cascade-fired actions are the engine's to fire — narrate, never button.
  const callable = evaluation.currentStage.activities.flatMap((activity) =>
    (activity.actions ?? [])
      .filter((action) => !action.triggered)
      .map((action) => ({action, activity: activity.activity.name})),
  )

  if (callable.length === 0) return null

  return (
    <Stack space={2}>
      <Text className="uppercase tracking-widest" muted size={0} weight="semibold">
        Actions
      </Text>
      <Flex gap={2} wrap="wrap">
        {callable.map(({action, activity}) => (
          <ActionButton
            activity={activity}
            evaluation={action}
            key={`${activity}.${action.action.name}`}
            onFire={(params) =>
              startTransition(async () => {
                await fireAction({action: action.action.name, activity, params})
              })
            }
            pending={pending}
          />
        ))}
      </Flex>
    </Stack>
  )
}

function RunRoute() {
  const {instanceId} = useParams()

  return (
    <Stack className="h-full overflow-y-auto" space={5}>
      <div className="dashboard-content">
        <div className="px-4 py-4">
          <ErrorBoundary featureName="Localization run">
            {instanceId ? (
              <RunDetail instanceId={instanceId} />
            ) : (
              <Text size={1}>No run selected.</Text>
            )}
          </ErrorBoundary>
        </div>
      </div>
    </Stack>
  )
}

export default RunRoute
