/**
 * Single-locale task card for translated documents.
 *
 * When an editor opens a translated document (e.g., es-ES/winter-hiking-guide),
 * this replaces the multi-locale overview with a focused task card.
 *
 * State machine with 4 renders:
 * - needsReview → approve + open source
 * - approved → read-only confirmation
 * - stale → diff + dismiss/re-translate
 * - missing → generate translation
 *
 * `usingFallback` maps to `missing` (same task: generate a direct translation).
 */

import {
  CheckmarkCircleIcon,
  CircleIcon,
  ClockIcon,
  EditIcon,
  LaunchIcon,
  SparklesIcon,
  WarningOutlineIcon,
} from '@sanity/icons'
import {Badge, Box, Button, Card, Flex, Heading, Stack, Text, Tooltip} from '@sanity/ui'
import {ShieldCheck} from 'lucide-react'
import type {ComponentType} from 'react'
import {useEffect, useState} from 'react'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, useClient, useRelativeTime, useTranslation} from 'sanity'
import {AIAnalysisError, AIAnalysisLoading, StaleAIAnalysis} from './StaleAIAnalysis'
import type {StaleAnalysisCache, WorkflowStateEntry} from '../core/types'
import {l10nLocaleNamespace} from '../i18n'
import {useStaleAIAnalysis} from './useStaleAIAnalysis'

// --- Types ---

export interface TranslatedDocTaskCardProps {
  /** Current document's locale ID (e.g., 'es-ES') */
  localeId: string
  /** Workflow state entry for this locale (from workflowStates map) */
  workflowEntry: WorkflowStateEntry | undefined
  /** Published ID of the base-language source document */
  sourceDocPublishedId: string | undefined
  /** Navigate to the base-language source document (opens in split pane) */
  onNavigateToSource: () => void
  /** Approve this locale's translation */
  onApprove: () => void
  /** Dismiss stale for this locale */
  onDismiss: () => void
  /** Re-translate this locale */
  onTranslate: () => void
  /** Whether a translation is currently in progress */
  isTranslating: boolean
  /** Cached AI stale analysis from metadata doc */
  staleAnalysis: StaleAnalysisCache | null
  /** Metadata document ID (for AI analysis cache) */
  metadataId: string | null
  /** Apply a single pre-translated field to this document */
  onApplyField: (fieldName: string, suggestedValue: unknown) => Promise<void>
  /** Apply all pending retranslate suggestions at once */
  onApplyAll: (translations: Array<{fieldName: string; suggestedValue: unknown}>) => Promise<void>
  /** Release name for UI labels (undefined = drafts perspective) */
  releaseName?: string
  /** Document ID of the translated document (for field-level diff rendering) */
  translatedDocumentId: string
}

type TaskCardState = 'needsReview' | 'approved' | 'stale' | 'missing'

// --- State detection ---

function getTaskCardState(entry: WorkflowStateEntry | undefined): TaskCardState {
  if (!entry) return 'missing'
  if (entry.status === 'usingFallback') return 'missing'
  if (entry.status === 'missing') return 'missing'
  if (entry.status === 'needsReview') return 'needsReview'
  if (entry.status === 'approved') return 'approved'
  if (entry.status === 'stale') return 'stale'
  // Exhaustive — shouldn't reach here with current TranslationWorkflowStatus
  return 'missing'
}

// --- State config ---

interface StateConfig {
  tone: 'caution' | 'positive' | 'default' | 'neutral'
  icon: ComponentType
  titleKey: string
}

const STATE_CONFIG: Record<TaskCardState, StateConfig> = {
  needsReview: {
    tone: 'caution',
    icon: EditIcon,
    titleKey: 'task-card.review-required',
  },
  approved: {
    tone: 'positive',
    icon: ShieldCheck,
    titleKey: 'task-card.translation-approved',
  },
  stale: {
    tone: 'neutral',
    icon: WarningOutlineIcon,
    titleKey: 'task-card.translation-stale',
  },
  missing: {
    tone: 'default',
    icon: CircleIcon,
    titleKey: 'task-card.no-translation',
  },
}

// --- Sub-components ---

function RelativeTimestamp({time, prefix}: {time: string; prefix: string}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const relative = useRelativeTime(time)
  return (
    <Text size={1} muted>
      {t('task-card.time-ago', {prefix, relative})}
    </Text>
  )
}

function TimeBadge({time, prefix}: {time: string; prefix: string}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const relative = useRelativeTime(time)
  return (
    <Badge tone="default" fontSize={1} padding={2}>
      <Flex align="center" gap={2}>
        <Text size={1}>
          <ClockIcon />
        </Text>
        <span>
          {t('task-card.time-ago', {prefix, relative})}
        </span>
      </Flex>
    </Badge>
  )
}

function TranslatedTimeBadge({time}: {time: string}) {
  return <TimeBadge time={time} prefix="Translated" />
}

function ApprovedTimeBadge({time}: {time: string}) {
  return <TimeBadge time={time} prefix="Approved" />
}

// --- State renders ---

function NeedsReviewContent({
  workflowEntry,
  onNavigateToSource,
  onApprove,
  isTranslating,
  releaseName,
}: {
  workflowEntry: WorkflowStateEntry
  onNavigateToSource: () => void
  onApprove: () => void
  isTranslating: boolean
  releaseName?: string
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const sourceLabel = workflowEntry.source === 'ai' ? t('task-card.source-ai') : t('task-card.source-manual')

  return (
    <>
      <Stack space={4}>
        <Flex gap={2} wrap="wrap">
          <Badge tone="default" fontSize={1} padding={2}>
            <Flex align="center" gap={2}>
              <Text size={1}>
                {workflowEntry.source === 'ai' ? <SparklesIcon /> : <EditIcon />}
              </Text>
              <span>{sourceLabel}</span>
            </Flex>
          </Badge>
          {workflowEntry.updatedAt && <TranslatedTimeBadge time={workflowEntry.updatedAt} />}
        </Flex>
        <Text size={1}>
          {t('task-card.review-description')}
        </Text>
      </Stack>

      <Box style={{borderTop: '1px solid var(--card-border-color)', paddingTop: 12}}>
        <Stack space={3}>
          <Button
            text={t('task-card.open-source')}
            icon={LaunchIcon}
            mode="ghost"
            onClick={onNavigateToSource}
            fontSize={1}
            padding={3}
          />
          <Tooltip
            content={
              <Box padding={2}>
                <Text size={1}>
                  {t('task-card.approve-description')}
                </Text>
              </Box>
            }
            animate
            placement="bottom"
            portal
            delay={500}
          >
            <Button
              text={t('task-card.approve')}
              icon={CheckmarkCircleIcon}
              tone="positive"
              onClick={onApprove}
              disabled={isTranslating}
              fontSize={1}
              padding={3}
              style={{width: '100%'}}
            />
          </Tooltip>
        </Stack>
      </Box>
    </>
  )
}

function useUser(userId: string | undefined) {
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const [user, setUser] = useState<{displayName?: string; imageUrl?: string} | null>(null)

  useEffect(() => {
    if (!userId) return
    const {projectId} = client.config()
    client
      .request<{displayName?: string; imageUrl?: string}>({
        url: `/projects/${projectId}/users/${userId}`,
      })
      .then(setUser)
      .catch(() => {
        /* user lookup failed – fall back to ID */
      })
  }, [client, userId])

  return user
}

function ApprovedContent({workflowEntry}: {workflowEntry: WorkflowStateEntry}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const sourceLabel = workflowEntry.source === 'ai' ? t('task-card.source-ai') : t('task-card.source-manual')
  const reviewer = useUser(workflowEntry.reviewedBy)

  return (
    <Stack space={2}>
      {workflowEntry.reviewedBy && (
        <Flex align="center" gap={2}>
          {reviewer?.imageUrl && (
            <img
              src={reviewer.imageUrl}
              alt=""
              style={{
                borderRadius: '50%',
                flexShrink: 0,
                height: 24,
                objectFit: 'cover',
                width: 24,
              }}
            />
          )}
          <Text size={2}>{t('task-card.approved-by', {name: reviewer?.displayName || workflowEntry.reviewedBy})}</Text>
        </Flex>
      )}
      <Flex gap={2} wrap="wrap">
        {workflowEntry.updatedAt && <ApprovedTimeBadge time={workflowEntry.updatedAt} />}
        <Badge tone="default" fontSize={1} padding={2}>
          <Flex align="center" gap={2}>
            <Text size={1}>{workflowEntry.source === 'ai' ? <SparklesIcon /> : <EditIcon />}</Text>
            <span>{sourceLabel}</span>
          </Flex>
        </Badge>
      </Flex>
    </Stack>
  )
}

function StaleContent({
  workflowEntry,
  sourceDocPublishedId,
  localeId,
  staleAnalysis,
  metadataId,
  onDismiss,
  onApplyField,
  onApplyAll,
  releaseName,
  translatedDocumentId,
}: {
  workflowEntry: WorkflowStateEntry
  sourceDocPublishedId: string | undefined
  localeId: string
  staleAnalysis: StaleAnalysisCache | null
  metadataId: string | null
  onDismiss: () => void
  onApplyField: (fieldName: string, suggestedValue: unknown) => Promise<void>
  onApplyAll: (translations: Array<{fieldName: string; suggestedValue: unknown}>) => Promise<void>
  releaseName?: string
  translatedDocumentId: string
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const aiAnalysis = useStaleAIAnalysis(
    staleAnalysis,
    workflowEntry.staleSourceRev,
    localeId,
    sourceDocPublishedId,
    workflowEntry.sourceRevision,
    metadataId,
    true,
  )

  return (
    <Stack space={4}>
      {/* Caution header card */}
      <Card padding={4} radius={2} tone="caution" border>
        <Stack space={3}>
          <Flex align="center" gap={2}>
            <Text size={4}>
              <WarningOutlineIcon />
            </Text>
            <Heading size={2}>{t('task-card.translation-stale')}</Heading>
          </Flex>
          {workflowEntry.updatedAt && (
            <RelativeTimestamp time={workflowEntry.updatedAt} prefix="Last translated" />
          )}
        </Stack>
      </Card>

      {aiAnalysis.isLoading && <AIAnalysisLoading />}
      {aiAnalysis.error && <AIAnalysisError error={aiAnalysis.error} onRetry={aiAnalysis.retry} />}
      {aiAnalysis.analysis && (
        <StaleAIAnalysis
          analysis={aiAnalysis.analysis}
          preTranslations={aiAnalysis.preTranslations}
          onApplyField={onApplyField}
          onApplyAll={onApplyAll}
          onDismissStale={onDismiss}
          releaseName={releaseName}
          translatedDocumentId={translatedDocumentId}
          staleAnalysisCache={staleAnalysis}
          metadataId={metadataId}
          localeId={localeId}
          staleSourceRev={workflowEntry.staleSourceRev}
        />
      )}
    </Stack>
  )
}

function MissingContent({
  onTranslate,
  isTranslating,
  releaseName,
}: {
  onTranslate: () => void
  isTranslating: boolean
  releaseName?: string
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  return (
    <>
      <Text size={1}>{t('task-card.no-translation-description')}</Text>

      <Box style={{borderTop: '1px solid var(--card-border-color)', paddingTop: 12}}>
        <Button
          text={releaseName ? t('task-card.generate-to-release', {releaseName}) : t('task-card.generate')}
          icon={SparklesIcon}
          tone="suggest"
          onClick={onTranslate}
          disabled={isTranslating}
          fontSize={1}
          padding={3}
          style={{width: '100%'}}
        />
      </Box>
    </>
  )
}

// --- Main component ---

export function TranslatedDocTaskCard({
  localeId,
  workflowEntry,
  sourceDocPublishedId,
  onNavigateToSource,
  onApprove,
  onDismiss,
  onTranslate,
  isTranslating,
  staleAnalysis,
  metadataId,
  onApplyField,
  onApplyAll,
  releaseName,
  translatedDocumentId,
}: TranslatedDocTaskCardProps) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const state = getTaskCardState(workflowEntry)
  const config = STATE_CONFIG[state]
  const Icon = config.icon

  // Stale state manages its own card layout (caution header + tabs outside card)
  if (state === 'stale' && workflowEntry) {
    return (
      <StaleContent
        workflowEntry={workflowEntry}
        sourceDocPublishedId={sourceDocPublishedId}
        localeId={localeId}
        staleAnalysis={staleAnalysis}
        metadataId={metadataId}
        onDismiss={onDismiss}
        onApplyField={onApplyField}
        onApplyAll={onApplyAll}
        releaseName={releaseName}
        translatedDocumentId={translatedDocumentId}
      />
    )
  }

  return (
    <Card padding={4} radius={4} tone={config.tone} border>
      <Stack space={4}>
        {/* Header */}
        <Flex align="center" gap={3}>
          <Text size={4}>
            <Icon />
          </Text>
          <Heading size={2}>{t(config.titleKey)}</Heading>
        </Flex>

        {state === 'needsReview' && workflowEntry && (
          <NeedsReviewContent
            workflowEntry={workflowEntry}
            onNavigateToSource={onNavigateToSource}
            onApprove={onApprove}
            isTranslating={isTranslating}
            releaseName={releaseName}
          />
        )}

        {state === 'approved' && workflowEntry && <ApprovedContent workflowEntry={workflowEntry} />}

        {state === 'missing' && (
          <MissingContent
            onTranslate={onTranslate}
            isTranslating={isTranslating}
            releaseName={releaseName}
          />
        )}
      </Stack>
    </Card>
  )
}
