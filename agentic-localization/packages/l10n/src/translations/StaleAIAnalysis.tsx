/**
 * AI Stale Change Analysis component.
 *
 * Renders the pre-computed AI analysis of source document changes with
 * actionable per-field suggestions. "Apply" is instant — patches pre-computed
 * translation values directly onto the document. No LLM call.
 *
 * Design spec: design-language v3.8, "AI Stale Change Analysis" section.
 */

import {
  CheckmarkCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleIcon,
  EditIcon,
  InfoOutlineIcon,
  SparklesIcon,
  WarningOutlineIcon,
} from '@sanity/icons'
import * as Accordion from '@radix-ui/react-accordion'
import {Badge, Button, Card, Flex, Heading, Label, Spinner, Stack, Text} from '@sanity/ui'
import {useCallback, useMemo, useState} from 'react'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, getPublishedId, useClient, useDocumentValues} from 'sanity'
import {toPlainText} from '@portabletext/toolkit'
import {InlineDiff} from './InlineDiff'
import {PortableTextDiff} from './PortableTextDiff'
import {getReviewProgress, writeReviewProgress} from '../core/staleAnalysisCache'
import styles from './SuggestionAccordion.module.css'
import type {
  PreTranslatedSuggestion,
  StaleAnalysisCache,
  StaleAnalysisResult,
  StaleAnalysisSuggestion,
} from '../core/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StaleAIAnalysisProps {
  /** AI analysis result */
  analysis: StaleAnalysisResult
  /** Pre-translations for the current locale */
  preTranslations: PreTranslatedSuggestion[]
  /** Apply a single pre-translated field */
  onApplyField: (fieldName: string, suggestedValue: unknown) => Promise<void>
  /** Apply all pending retranslate suggestions at once */
  onApplyAll: (translations: Array<{fieldName: string; suggestedValue: unknown}>) => Promise<void>
  /** Dismiss stale state entirely (called after all suggestions resolved) */
  onDismissStale: () => void
  /** Whether dismiss is in progress */
  isDismissing?: boolean
  /** Release name for UI labels (undefined = drafts perspective) */
  releaseName?: string
  /** Document ID of the translated document (for field-level diff rendering) */
  translatedDocumentId: string
  /** Raw staleAnalysis cache from metadata doc (for reading persisted review progress) */
  staleAnalysisCache?: StaleAnalysisCache | null
  /** Metadata document ID (for persisting review progress) */
  metadataId?: string | null
  /** Current locale ID (for scoping persisted progress) */
  localeId?: string
  /** Current stale source revision (cache key for progress) */
  staleSourceRev?: string
}

type SuggestionStatus = 'pending' | 'applied' | 'skipped'

// ---------------------------------------------------------------------------
// Materiality config
// ---------------------------------------------------------------------------

const MATERIALITY_CONFIG = {
  cosmetic: {
    tone: 'default' as const,
    icon: CircleIcon,
    label: 'Cosmetic',
  },
  minor: {
    tone: 'caution' as const,
    icon: EditIcon,
    label: 'Minor Impact',
  },
  material: {
    tone: 'critical' as const,
    icon: WarningOutlineIcon,
    label: 'Material Impact',
  },
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MaterialityBadge({
  materiality,
  explanation,
}: {
  materiality: StaleAnalysisResult['materiality']
  explanation: string
}) {
  const config = MATERIALITY_CONFIG[materiality]
  const Icon = config.icon

  return (
    <Card tone={config.tone} padding={4} radius={4} border>
      <Stack space={4}>
        <Flex align="center" gap={3}>
          <Text size={4}>
            <Icon />
          </Text>
          <Heading size={2}>{config.label}</Heading>
        </Flex>
        <Text size={2}>{explanation}</Text>
      </Stack>
    </Card>
  )
}

function useCurrentFieldValue(
  translatedDocumentId: string,
  fieldName: string,
): unknown | undefined {
  const publishedId = getPublishedId(translatedDocumentId)
  const paths = useMemo(() => [fieldName], [fieldName])
  const {value, isLoading} = useDocumentValues(publishedId, paths)
  if (isLoading) return undefined
  return (value as Record<string, unknown> | undefined)?.[fieldName]
}

function fieldValueToText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return toPlainText(value)
  return ''
}

const PREVIEW_TRUNCATE_LENGTH = 200

function truncatePreview(text: string): string {
  if (text.length <= PREVIEW_TRUNCATE_LENGTH) return text
  return text.slice(0, PREVIEW_TRUNCATE_LENGTH) + '…'
}

function TranslationPreview({
  translatedDocumentId,
  fieldName,
  suggestedValue,
}: {
  translatedDocumentId: string
  fieldName: string
  suggestedValue: unknown
}) {
  const currentValue = useCurrentFieldValue(translatedDocumentId, fieldName)

  if (currentValue === undefined) {
    return (
      <Flex align="center" gap={2} padding={2}>
        <Spinner muted />
        <Text size={0} muted>
          Loading preview…
        </Text>
      </Flex>
    )
  }

  const currentText = fieldValueToText(currentValue)
  const suggestedText = fieldValueToText(suggestedValue)

  if (!currentText && !suggestedText) {
    return (
      <Text size={1} muted>
        Preview unavailable
      </Text>
    )
  }

  return (
    <Stack space={4}>
      {currentText && (
        <Stack space={2}>
          <Label size={2} weight="semibold" muted>
            Current
          </Label>
          <Card padding={3} radius={2} tone="caution" border>
            <Text size={1} muted style={{lineHeight: 1.5}}>
              {truncatePreview(currentText)}
            </Text>
          </Card>
        </Stack>
      )}
      {suggestedText && (
        <Stack space={2}>
          <Label size={2} weight="semibold" muted>
            Suggested
          </Label>
          <Card padding={3} radius={2} tone="positive" border>
            <Text size={1} style={{lineHeight: 1.5}}>
              {truncatePreview(suggestedText)}
            </Text>
          </Card>
        </Stack>
      )}
    </Stack>
  )
}

function SuggestionDiff({
  translatedDocumentId,
  fieldName,
  suggestedValue,
}: {
  translatedDocumentId: string
  fieldName: string
  suggestedValue: unknown
}) {
  const currentValue = useCurrentFieldValue(translatedDocumentId, fieldName)

  if (currentValue === undefined) {
    return (
      <Flex align="center" gap={2} padding={2}>
        <Spinner muted />
        <Text size={0} muted>
          Loading diff…
        </Text>
      </Flex>
    )
  }

  if (Array.isArray(currentValue) && Array.isArray(suggestedValue)) {
    return <PortableTextDiff oldBlocks={currentValue} newBlocks={suggestedValue} />
  }

  if (typeof currentValue === 'string' && typeof suggestedValue === 'string') {
    return <InlineDiff oldValue={currentValue} newValue={suggestedValue} />
  }

  return (
    <Text size={1} muted>
      Preview unavailable
    </Text>
  )
}

function ImpactChips({suggestion}: {suggestion: StaleAnalysisSuggestion}) {
  const tags = suggestion.impactTags
  if (!tags?.length) return null

  return (
    <Flex gap={1} wrap="wrap">
      {tags.map((tag) => (
        <Badge key={tag} fontSize={0} tone="caution" mode="outline">
          {tag}
        </Badge>
      ))}
    </Flex>
  )
}

function SuggestionAccordionHeader({
  suggestion,
  status,
}: {
  suggestion: StaleAnalysisSuggestion
  status: SuggestionStatus
}) {
  const fieldLabel = suggestion.fieldName.charAt(0).toUpperCase() + suggestion.fieldName.slice(1)
  const isRetranslate = suggestion.recommendation === 'retranslate'
  const isMuted = status === 'skipped'

  const leadingIcon =
    status === 'applied' ? <CheckmarkCircleIcon /> : status === 'skipped' ? null : null
  const trailingBadge = (() => {
    if (status === 'applied') {
      return (
        <Badge fontSize={1} padding={2} tone={isRetranslate ? 'positive' : 'default'}>
          {isRetranslate ? 'Translation updated' : 'Kept current'}
        </Badge>
      )
    }
    if (status === 'skipped') {
      return (
        <Badge fontSize={1} padding={2} tone="caution">
          Skipped
        </Badge>
      )
    } else {
      return (
        <Badge fontSize={1} padding={2} tone="default">
          Pending
        </Badge>
      )
    }
  })()

  return (
    <Accordion.Header asChild>
      <Accordion.Trigger className={styles.trigger}>
        <Text size={2} muted={isMuted}>
          {leadingIcon}
        </Text>
        <Stack space={1} style={{flex: 1}}>
          <Text size={2} weight="semibold" muted={isMuted}>
            {fieldLabel}
          </Text>
        </Stack>
        {trailingBadge}
      </Accordion.Trigger>
    </Accordion.Header>
  )
}

function SuggestionAccordionPanel({
  suggestion,
  preTranslation,
  isApplying,
  onApply,
  onSkip,
  translatedDocumentId,
}: {
  suggestion: StaleAnalysisSuggestion
  preTranslation: PreTranslatedSuggestion | undefined
  isApplying: boolean
  onApply: () => void
  onSkip: () => void
  translatedDocumentId: string
}) {
  const [showDiff, setShowDiff] = useState(false)

  const isRetranslate = suggestion.recommendation === 'retranslate'
  const hasPreTranslation = !!preTranslation
  const applyDisabled = isRetranslate && !hasPreTranslation
  const whatChanged = suggestion.changeSummary || suggestion.explanation

  return (
    <Accordion.Content className={styles.panel} forceMount={undefined}>
      <div className={styles.panelContent}>
        <Stack space={4}>
          {/* --- Recommendation section --- */}
          <Stack space={3}>
            <Card padding={3} radius={2} tone="suggest" border>
              <Text size={2} weight="semibold">
                Recommendation: {isRetranslate ? 'Update translation' : 'Keep current translation'}
              </Text>
            </Card>
            {isRetranslate && hasPreTranslation && (
              <TranslationPreview
                translatedDocumentId={translatedDocumentId}
                fieldName={suggestion.fieldName}
                suggestedValue={preTranslation!.suggestedValue}
              />
            )}
          </Stack>

          {/* --- Reason section --- */}
          <Stack space={3}>
            <Label size={2} weight="semibold" muted>
              Reason
            </Label>
            <Card padding={3} radius={2} tone="suggest" border>
              <Text size={1}>{whatChanged}</Text>
            </Card>
            <ImpactChips suggestion={suggestion} />
          </Stack>

          {/* --- Word-level diff (progressive disclosure) --- */}
          {isRetranslate && hasPreTranslation && (
            <Stack space={2}>
              <Flex
                align="center"
                gap={1}
                as="button"
                onClick={() => setShowDiff((prev) => !prev)}
                style={{
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                }}
              >
                <Text size={0} muted>
                  {showDiff ? <ChevronDownIcon /> : <ChevronRightIcon />}
                </Text>
                <Text size={0} muted>
                  {showDiff ? 'Hide word-level changes' : 'Show word-level changes'}
                </Text>
              </Flex>
              {showDiff && (
                <SuggestionDiff
                  translatedDocumentId={translatedDocumentId}
                  fieldName={suggestion.fieldName}
                  suggestedValue={preTranslation!.suggestedValue}
                />
              )}
            </Stack>
          )}

          {applyDisabled && (
            <Text size={0} muted>
              Suggested translation not yet available
            </Text>
          )}

          {/* --- Actions --- */}
          <Stack space={2}>
            <Button
              text={isRetranslate ? 'Apply suggested update' : 'Keep current translation'}
              icon={CheckmarkCircleIcon}
              tone="positive"
              onClick={onApply}
              disabled={applyDisabled || isApplying}
              loading={isApplying}
              fontSize={1}
              padding={3}
              style={{width: '100%'}}
            />
            <Button
              text="Skip"
              mode="ghost"
              onClick={onSkip}
              disabled={isApplying}
              fontSize={1}
              padding={3}
              style={{width: '100%'}}
            />
          </Stack>
        </Stack>
      </div>
    </Accordion.Content>
  )
}

// ---------------------------------------------------------------------------
// Loading + Error states (exported for T6 wiring)
// ---------------------------------------------------------------------------

export function AIAnalysisLoading() {
  return (
    <Flex align="center" gap={2} padding={3}>
      <Spinner muted />
      <Text size={1} muted>
        Analyzing changes…
      </Text>
    </Flex>
  )
}

export function AIAnalysisError({error, onRetry}: {error: Error; onRetry: () => void}) {
  return (
    <Stack space={3} padding={3}>
      <Text size={1}>Unable to analyze changes.</Text>
      <Button text="Retry" onClick={onRetry} mode="ghost" />
      <Text size={1} muted>
        You can still review changes manually in the Raw Diff tab.
      </Text>
    </Stack>
  )
}

// ---------------------------------------------------------------------------
// Sticky action bar (rendered outside the scrollable area by the parent)
// ---------------------------------------------------------------------------

export interface StaleAIAnalysisStickyBarProps {
  allResolved: boolean
  pendingCount: number
  retranslatedCount: number
  dismissedCount: number
  skippedCount: number
  isApplyingAll: boolean
  onApplyAll: () => void
  onDismissStale: () => void
  isDismissing: boolean
}

export function StaleAIAnalysisStickyBar({
  allResolved,
  pendingCount,
  retranslatedCount,
  dismissedCount,
  skippedCount,
  isApplyingAll,
  onApplyAll,
  onDismissStale,
  isDismissing,
}: StaleAIAnalysisStickyBarProps) {
  const hasContent = allResolved || pendingCount > 0
  if (!hasContent) return null

  return (
    <Card
      padding={3}
      borderTop
      style={{position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1}}
    >
      {allResolved ? (
        <Stack space={3}>
          <Flex gap={2} wrap="wrap">
            {retranslatedCount > 0 && (
              <Badge tone="positive" fontSize={1} padding={2}>
                {retranslatedCount} translation{retranslatedCount !== 1 ? 's' : ''} updated
              </Badge>
            )}
            {dismissedCount > 0 && (
              <Badge tone="default" fontSize={1} padding={2}>
                {dismissedCount} kept as-is
              </Badge>
            )}
            {skippedCount > 0 && (
              <Badge tone="caution" fontSize={1} padding={2}>
                {skippedCount} skipped
              </Badge>
            )}
          </Flex>
          <Button
            text="Mark as Reviewed"
            icon={CheckmarkCircleIcon}
            tone="positive"
            onClick={onDismissStale}
            disabled={isDismissing}
            loading={isDismissing}
            style={{width: '100%'}}
          />
        </Stack>
      ) : (
        <Button
          text="Apply all recommendations"
          icon={SparklesIcon}
          tone="primary"
          onClick={onApplyAll}
          disabled={isApplyingAll}
          loading={isApplyingAll}
          style={{width: '100%'}}
        />
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StaleAIAnalysis({
  analysis,
  preTranslations,
  onApplyField,
  onApplyAll,
  onDismissStale,
  isDismissing = false,
  releaseName,
  translatedDocumentId,
  staleAnalysisCache,
  metadataId,
  localeId,
  staleSourceRev,
}: StaleAIAnalysisProps) {
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)

  // Seed from persisted review progress (survives navigation)
  const persistedFields = useMemo(
    () =>
      staleAnalysisCache && staleSourceRev && localeId
        ? getReviewProgress(staleAnalysisCache, staleSourceRev, localeId)
        : null,
    [staleAnalysisCache, staleSourceRev, localeId],
  )

  const [suggestionStatuses, setSuggestionStatuses] = useState<Record<string, SuggestionStatus>>(
    () => (persistedFields as Record<string, SuggestionStatus>) ?? {},
  )
  const [applyingFields, setApplyingFields] = useState<Set<string>>(new Set())
  const [isApplyingAll, setIsApplyingAll] = useState(false)
  const [expandedField, setExpandedField] = useState<string | null>(() => {
    const statuses = (persistedFields as Record<string, SuggestionStatus>) ?? {}
    const firstPending = analysis.suggestions.find((s) => !statuses[s.fieldName])
    return firstPending?.fieldName ?? null
  })

  // Fire-and-forget persistence of review progress to metadata doc
  const persistProgress = useCallback(
    (updatedStatuses: Record<string, SuggestionStatus>) => {
      if (!metadataId || !staleSourceRev || !localeId) return
      const fields: Record<string, 'applied' | 'skipped'> = {}
      for (const [fieldName, status] of Object.entries(updatedStatuses)) {
        if (status === 'applied' || status === 'skipped') {
          fields[fieldName] = status
        }
      }
      writeReviewProgress(client, metadataId, staleSourceRev, localeId, fields).catch((err) =>
        console.error('[StaleAIAnalysis] Failed to persist review progress:', err),
      )
    },
    [client, metadataId, staleSourceRev, localeId],
  )

  // Pre-translation lookup map
  const preTranslationMap = useMemo(() => {
    const map = new Map<string, PreTranslatedSuggestion>()
    for (const pt of preTranslations) {
      map.set(pt.fieldName, pt)
    }
    return map
  }, [preTranslations])

  // Derived counts
  const resolvedCount = useMemo(
    () =>
      analysis.suggestions.filter(
        (s) =>
          suggestionStatuses[s.fieldName] === 'applied' ||
          suggestionStatuses[s.fieldName] === 'skipped',
      ).length,
    [analysis.suggestions, suggestionStatuses],
  )

  const allResolved =
    resolvedCount === analysis.suggestions.length && analysis.suggestions.length > 0

  const retranslatedCount = useMemo(
    () =>
      analysis.suggestions.filter(
        (s) => s.recommendation === 'retranslate' && suggestionStatuses[s.fieldName] === 'applied',
      ).length,
    [analysis.suggestions, suggestionStatuses],
  )

  const dismissedCount = useMemo(
    () =>
      analysis.suggestions.filter(
        (s) => s.recommendation === 'dismiss' && suggestionStatuses[s.fieldName] === 'applied',
      ).length,
    [analysis.suggestions, suggestionStatuses],
  )

  const skippedCount = useMemo(
    () => analysis.suggestions.filter((s) => suggestionStatuses[s.fieldName] === 'skipped').length,
    [analysis.suggestions, suggestionStatuses],
  )

  const pendingCount = useMemo(
    () => analysis.suggestions.filter((s) => !suggestionStatuses[s.fieldName]).length,
    [analysis.suggestions, suggestionStatuses],
  )

  // Find the next pending field after a given field name
  const findNextPending = useCallback(
    (afterField: string): string | null => {
      const idx = analysis.suggestions.findIndex((s) => s.fieldName === afterField)
      for (let i = idx + 1; i < analysis.suggestions.length; i++) {
        if (!suggestionStatuses[analysis.suggestions[i]!.fieldName]) {
          return analysis.suggestions[i]!.fieldName
        }
      }
      // Wrap around to check before the current field
      for (let i = 0; i < idx; i++) {
        if (!suggestionStatuses[analysis.suggestions[i]!.fieldName]) {
          return analysis.suggestions[i]!.fieldName
        }
      }
      return null
    },
    [analysis.suggestions, suggestionStatuses],
  )

  // --- Handlers ---

  const handleApply = useCallback(
    async (suggestion: StaleAnalysisSuggestion) => {
      const pt = preTranslationMap.get(suggestion.fieldName)

      setApplyingFields((prev) => new Set(prev).add(suggestion.fieldName))

      try {
        if (suggestion.recommendation === 'retranslate' && pt) {
          await onApplyField(suggestion.fieldName, pt.suggestedValue)
        }
        setSuggestionStatuses((prev) => {
          const next = {...prev, [suggestion.fieldName]: 'applied' as const}
          persistProgress(next)
          return next
        })
        setExpandedField(findNextPending(suggestion.fieldName))
      } catch (err) {
        console.error(`Failed to apply suggestion for ${suggestion.fieldName}:`, err)
      } finally {
        setApplyingFields((prev) => {
          const next = new Set(prev)
          next.delete(suggestion.fieldName)
          return next
        })
      }
    },
    [onApplyField, preTranslationMap, findNextPending, persistProgress],
  )

  const handleSkip = useCallback(
    (fieldName: string) => {
      setSuggestionStatuses((prev) => {
        const next = {...prev, [fieldName]: 'skipped' as const}
        persistProgress(next)
        return next
      })
      setExpandedField(findNextPending(fieldName))
    },
    [findNextPending, persistProgress],
  )

  const handleApplyAll = useCallback(async () => {
    setIsApplyingAll(true)

    try {
      const retranslateFields: Array<{fieldName: string; suggestedValue: unknown}> = []
      const allPending = analysis.suggestions.filter((s) => !suggestionStatuses[s.fieldName])

      for (const suggestion of allPending) {
        if (suggestion.recommendation === 'retranslate') {
          const pt = preTranslationMap.get(suggestion.fieldName)
          if (pt) {
            retranslateFields.push({fieldName: pt.fieldName, suggestedValue: pt.suggestedValue})
          }
        }
      }

      if (retranslateFields.length > 0) {
        await onApplyAll(retranslateFields)
      }

      setSuggestionStatuses((prev) => {
        const next = {...prev}
        for (const suggestion of allPending) {
          next[suggestion.fieldName] = 'applied'
        }
        persistProgress(next)
        return next
      })
      setExpandedField(null)
    } catch (err) {
      console.error('Failed to apply all suggestions:', err)
    } finally {
      setIsApplyingAll(false)
    }
  }, [analysis.suggestions, suggestionStatuses, preTranslationMap, onApplyAll, persistProgress])

  const handleValueChange = useCallback((value: string) => {
    setExpandedField(value || null)
  }, [])

  // --- Render ---

  const {explanation} = analysis

  return (
    <>
      <Stack space={4}>
        {/* Materiality badge with merged explanation */}
        <Stack space={3}>
          <Label size={2}>Summary</Label>
          <MaterialityBadge materiality={analysis.materiality} explanation={explanation} />
        </Stack>

        {/* Accordion list */}

        <Accordion.Root
          type="single"
          collapsible
          value={expandedField ?? ''}
          onValueChange={handleValueChange}
        >
          <Label size={2} style={{marginBottom: 12}}>
            Fields to review
          </Label>
          <Stack space={2}>
            {analysis.suggestions.map((suggestion) => {
              const status = suggestionStatuses[suggestion.fieldName] ?? 'pending'
              const isRetranslate = suggestion.recommendation === 'retranslate'
              const cardTone =
                status === 'applied' ? (isRetranslate ? 'positive' : 'default') : 'default'

              return (
                <Accordion.Item key={suggestion.fieldName} value={suggestion.fieldName} asChild>
                  <Card radius={4} border tone={cardTone}>
                    <SuggestionAccordionHeader suggestion={suggestion} status={status} />
                    <SuggestionAccordionPanel
                      suggestion={suggestion}
                      preTranslation={preTranslationMap.get(suggestion.fieldName)}
                      isApplying={applyingFields.has(suggestion.fieldName) || isApplyingAll}
                      onApply={() => handleApply(suggestion)}
                      onSkip={() => handleSkip(suggestion.fieldName)}
                      translatedDocumentId={translatedDocumentId}
                    />
                  </Card>
                </Accordion.Item>
              )
            })}
          </Stack>
        </Accordion.Root>

        {/* Dropped suggestion info (R5) */}
        {analysis.droppedSuggestionCount && analysis.droppedSuggestionCount > 0 && (
          <Flex align="center" gap={2}>
            <Text size={1} muted>
              <InfoOutlineIcon />
            </Text>
            <Text size={1} muted>
              {analysis.droppedSuggestionCount} suggestion
              {analysis.droppedSuggestionCount !== 1 ? 's were' : ' was'} excluded (referenced an
              unrecognized field)
            </Text>
          </Flex>
        )}
      </Stack>

      <StaleAIAnalysisStickyBar
        allResolved={allResolved}
        pendingCount={pendingCount}
        retranslatedCount={retranslatedCount}
        dismissedCount={dismissedCount}
        skippedCount={skippedCount}
        isApplyingAll={isApplyingAll}
        onApplyAll={handleApplyAll}
        onDismissStale={onDismissStale}
        isDismissing={isDismissing}
      />
    </>
  )
}
