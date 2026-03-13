/**
 * Field-level translation inspector UI — shows a field × locale matrix
 * for documents with `internationalizedArray*` fields.
 *
 * Layout:
 * - Summary bar: workflow status counts, progress bar
 * - Matrix table: rows = fields, columns = locales
 * - Status cells: workflow-aware dots (missing, needsReview, approved, stale)
 * - Stale cells: click to show diff popover with dismiss/re-translate
 * - Action bar: translate empty + approve all buttons
 */

import {CheckmarkCircleIcon, CloseIcon, SparklesIcon, TranslateIcon} from '@sanity/icons'
import {Badge, Box, Button, Card, Flex, Spinner, Stack, Text, Tooltip} from '@sanity/ui'
import {useMemo} from 'react'
import {useTranslation} from 'sanity'

import {
  useInternationalizedFields,
  type InternationalizedFieldDescriptor,
} from '../fieldActions/useInternationalizedFields'
import type {FieldCellState} from '../core/types'
import {l10nLocaleNamespace} from '../i18n'
import {useLocales, type Language} from './useLocales'
import {useFieldTranslationData, type FieldTranslationSnapshot} from './useFieldTranslationData'
import {useFieldTranslateActions, type CellInFlightState} from './useFieldTranslateActions'
import {useFieldWorkflowMetadata} from './useFieldWorkflowMetadata'
import {deriveFieldCellStates} from './deriveFieldCellStates'
import {useStaleSyncEffect} from './useStaleSyncEffect'
import {StaleDiffPopover} from './StaleDiffPopover'
import {getStatusDisplay} from './getStatusDisplay'
import {ErrorBoundary} from './ErrorBoundary'

export interface FieldTranslationContentProps {
  documentId: string
  documentType: string
  onClose?: () => void
}

const SCHEMA_ID = '_.schemas.default'

export function FieldTranslationContent({
  documentId,
  documentType,
  onClose,
}: FieldTranslationContentProps) {
  const {t} = useTranslation(l10nLocaleNamespace)

  const allFields = useInternationalizedFields(documentType)
  const locales = useLocales()
  const snapshot = useFieldTranslationData(documentId, allFields, locales)
  const metadata = useFieldWorkflowMetadata(documentId)

  // Derive workflow-aware cell states
  const cellStates = useMemo(
    () => deriveFieldCellStates(snapshot, metadata.stateMap, snapshot.currentSourceValues),
    [snapshot, metadata.stateMap],
  )

  // Lazy-persist newly-stale entries
  useStaleSyncEffect(cellStates, metadata.stateMap, metadata.metadataId, snapshot.currentSourceValues)

  const {
    translateCell,
    translateField,
    translateAllEmpty,
    approveCell,
    approveAll,
    dismissStaleCell,
    inFlightStates,
    isTranslating,
  } = useFieldTranslateActions(snapshot, SCHEMA_ID, documentType, cellStates)

  // Compute summary counts
  const {missingCount, needsReviewCount, approvedCount, staleCount, totalCount} = useMemo(() => {
    let missing = 0
    let needsReview = 0
    let approved = 0
    let stale = 0
    for (const [fieldPath, localeStates] of Object.entries(cellStates)) {
      const sourceLocale = snapshot.sourceLanguages[fieldPath]
      if (!sourceLocale) continue
      for (const [localeId, state] of Object.entries(localeStates)) {
        if (localeId === sourceLocale) continue
        switch (state.status) {
          case 'missing':
            missing++
            break
          case 'needsReview':
            needsReview++
            break
          case 'approved':
            approved++
            break
          case 'stale':
            stale++
            break
        }
      }
    }
    return {
      missingCount: missing,
      needsReviewCount: needsReview,
      approvedCount: approved,
      staleCount: stale,
      totalCount: missing + needsReview + approved + stale,
    }
  }, [cellStates, snapshot.sourceLanguages])

  const progressPercent = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0

  // Group fields by parent for nested display
  const fieldGroups = useMemo(() => {
    const groups: Array<{parent: string | null; fields: typeof snapshot.fields}> = []
    let currentParent: string | null = null
    let currentGroup: typeof snapshot.fields = []

    for (const field of snapshot.fields) {
      const parent = field.depth > 0 ? field.path.slice(0, -1).join('.') : null
      if (parent !== currentParent) {
        if (currentGroup.length > 0) {
          groups.push({parent: currentParent, fields: currentGroup})
        }
        currentParent = parent
        currentGroup = []
      }
      currentGroup.push(field)
    }
    if (currentGroup.length > 0) {
      groups.push({parent: currentParent, fields: currentGroup})
    }
    return groups
  }, [snapshot.fields])

  if (snapshot.fields.length === 0) {
    return (
      <Card padding={4}>
        <Flex align="center" gap={3} direction="column" justify="center" height="fill">
          <Text align="center" muted size={2}>
            <TranslateIcon />
          </Text>
          <Text align="center" muted size={1}>
            {t('field-translations.no-fields')}
          </Text>
        </Flex>
      </Card>
    )
  }

  if (locales.length === 0) {
    return (
      <Card padding={4}>
        <Flex align="center" gap={3} direction="column" justify="center" height="fill">
          <Text align="center" muted size={2}>
            <TranslateIcon />
          </Text>
          <Text align="center" muted size={1}>
            {t('field-translations.no-locales')}
          </Text>
        </Flex>
      </Card>
    )
  }

  return (
    <ErrorBoundary featureName={t('field-translations.title')}>
      <Flex direction="column" height="fill" overflow="hidden">
        {/* Header */}
        <Flex
          flex="none"
          align="center"
          paddingLeft={4}
          paddingRight={2}
          paddingTop={1}
          gap={2}
          style={{position: 'relative', zIndex: 1}}
        >
          <Text size={1}>
            <TranslateIcon />
          </Text>
          <Text size={1} weight="medium">
            {t('field-translations.title')}
          </Text>
          <Box flex={1} />
          {onClose && (
            <Tooltip
              content={
                <Box padding={2}>
                  <Text size={1}>{t('close')}</Text>
                </Box>
              }
              animate
              placement="bottom"
              portal
            >
              <Button aria-label={t('close-inspector')} icon={CloseIcon} mode="bleed" onClick={onClose} />
            </Tooltip>
          )}
        </Flex>

        {/* Content */}
        <Box flex={1} overflow="auto" padding={3}>
          <Stack space={4}>
            {/* Progress summary */}
            <Card padding={3} radius={2} tone="neutral" border>
              <Stack space={3}>
                <Flex align="center" justify="space-between">
                  <Text size={1} weight="semibold">
                    {t('field-translations.progress', {approved: approvedCount, total: totalCount})}
                  </Text>
                  <Text size={1} muted>
                    {progressPercent}%
                  </Text>
                </Flex>

                <Box
                  style={{
                    border: '1px solid rgba(0, 0, 0, 0.15)',
                    borderRadius: 4,
                    display: 'flex',
                    height: 24,
                    overflow: 'hidden',
                    width: '100%',
                  }}
                >
                  {approvedCount > 0 && (
                    <Box
                      style={{
                        background: 'var(--card-badge-positive-bg-color)',
                        height: '100%',
                        transition: 'width 0.3s ease',
                        width: `${(approvedCount / totalCount) * 100}%`,
                      }}
                    />
                  )}
                  {needsReviewCount > 0 && (
                    <Box
                      style={{
                        background: 'var(--card-badge-caution-bg-color)',
                        height: '100%',
                        transition: 'width 0.3s ease',
                        width: `${(needsReviewCount / totalCount) * 100}%`,
                      }}
                    />
                  )}
                  {staleCount > 0 && (
                    <Box
                      style={{
                        background: 'var(--card-badge-caution-bg-color)',
                        height: '100%',
                        transition: 'width 0.3s ease',
                        width: `${(staleCount / totalCount) * 100}%`,
                        opacity: 0.6,
                      }}
                    />
                  )}
                  {missingCount > 0 && (
                    <Box
                      style={{
                        background: 'var(--card-badge-critical-bg-color)',
                        height: '100%',
                        transition: 'width 0.3s ease',
                        width: `${(missingCount / totalCount) * 100}%`,
                      }}
                    />
                  )}
                </Box>

                <Flex gap={2} wrap="wrap">
                  {approvedCount > 0 && (
                    <Badge tone="positive" fontSize={1} padding={2}>
                      {t('field-translations.badge.approved', {count: approvedCount})}
                    </Badge>
                  )}
                  {needsReviewCount > 0 && (
                    <Badge tone="caution" fontSize={1} padding={2}>
                      {t('field-translations.badge.review', {count: needsReviewCount})}
                    </Badge>
                  )}
                  {staleCount > 0 && (
                    <Badge tone="caution" fontSize={1} padding={2}>
                      {t('field-translations.badge.stale', {count: staleCount})}
                    </Badge>
                  )}
                  {missingCount > 0 && (
                    <Badge tone="critical" fontSize={1} padding={2}>
                      {t('field-translations.badge.missing', {count: missingCount})}
                    </Badge>
                  )}
                </Flex>
              </Stack>
            </Card>

            {/* Matrix table */}
            <Card radius={2} border style={{overflow: 'hidden'}}>
              <Box style={{overflowX: 'auto'}}>
                <table
                  style={{
                    borderCollapse: 'collapse',
                    fontSize: 13,
                    tableLayout: 'auto',
                    width: '100%',
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          borderBottom: '1px solid var(--card-border-color)',
                          fontWeight: 500,
                          padding: '8px 12px',
                          position: 'sticky',
                          left: 0,
                          background: 'var(--card-bg-color)',
                          textAlign: 'left',
                          zIndex: 1,
                        }}
                      >
                        <Text size={1} weight="semibold">
                          {t('field-translations.header.field')}
                        </Text>
                      </th>
                      {locales.map((locale) => (
                        <th
                          key={locale.id}
                          style={{
                            borderBottom: '1px solid var(--card-border-color)',
                            fontWeight: 500,
                            padding: '8px',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Text size={1} weight="medium" style={{cursor: 'default'}}>
                            {locale.id}
                          </Text>
                        </th>
                      ))}
                      <th
                        style={{
                          borderBottom: '1px solid var(--card-border-color)',
                          padding: '8px',
                          width: 1,
                        }}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {fieldGroups.map((group) => (
                      <FieldGroup
                        key={group.parent ?? '__root'}
                        parent={group.parent}
                        fields={group.fields}
                        locales={locales}
                        cellStates={cellStates}
                        sourceLanguages={snapshot.sourceLanguages}
                        currentSourceValues={snapshot.currentSourceValues}
                        inFlightStates={inFlightStates}
                        onTranslateCell={translateCell}
                        onTranslateField={translateField}
                        onApproveCell={approveCell}
                        onDismissStale={dismissStaleCell}
                      />
                    ))}
                  </tbody>
                </table>
              </Box>
            </Card>

            {/* Legend */}
            <Flex gap={3} align="center" paddingX={1} wrap="wrap">
              <Flex align="center" gap={1}>
                <WorkflowDot status="approved" />
                <Text size={0} muted>
                  {t('field-translations.legend.approved')}
                </Text>
              </Flex>
              <Flex align="center" gap={1}>
                <WorkflowDot status="needsReview" />
                <Text size={0} muted>
                  {t('field-translations.legend.review')}
                </Text>
              </Flex>
              <Flex align="center" gap={1}>
                <WorkflowDot status="stale" />
                <Text size={0} muted>
                  {t('field-translations.legend.stale')}
                </Text>
              </Flex>
              <Flex align="center" gap={1}>
                <WorkflowDot status="missing" />
                <Text size={0} muted>
                  {t('field-translations.legend.missing')}
                </Text>
              </Flex>
            </Flex>
          </Stack>
        </Box>

        {/* Action bar */}
        <Card
          padding={3}
          borderTop
          style={{position: 'sticky', bottom: 0, zIndex: 1}}
        >
          <Stack space={2}>
            {missingCount > 0 && (
              <Button
                fontSize={1}
                mode="default"
                tone="suggest"
                icon={SparklesIcon}
                onClick={translateAllEmpty}
                text={t('field-translations.action.translate-missing', {count: missingCount})}
                disabled={missingCount === 0 || isTranslating}
                style={{width: '100%'}}
              />
            )}
            {needsReviewCount > 0 && (
              <Button
                fontSize={1}
                mode="ghost"
                tone="positive"
                icon={CheckmarkCircleIcon}
                onClick={approveAll}
                text={t('field-translations.action.approve', {count: needsReviewCount})}
                style={{width: '100%'}}
              />
            )}
          </Stack>
        </Card>
      </Flex>
    </ErrorBoundary>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<FieldCellState['status'], {bg: string; border: string}> = {
  approved: {
    bg: 'var(--card-badge-positive-fg-color)',
    border: 'var(--card-badge-positive-fg-color)',
  },
  needsReview: {
    bg: 'var(--card-badge-caution-fg-color)',
    border: 'var(--card-badge-caution-fg-color)',
  },
  stale: {
    bg: 'var(--card-badge-caution-fg-color)',
    border: 'var(--card-badge-caution-fg-color)',
  },
  missing: {
    bg: 'transparent',
    border: 'var(--card-border-color)',
  },
}

function WorkflowDot({status}: {status: FieldCellState['status']}) {
  const colors = STATUS_COLORS[status]
  return (
    <Box
      style={{
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: '50%',
        height: 10,
        width: 10,
        flexShrink: 0,
        opacity: status === 'stale' ? 0.7 : 1,
      }}
    />
  )
}

function CellStatus({
  fieldPath,
  localeId,
  cellState,
  isSource,
  inFlight,
  currentSourceValue,
  onTranslate,
  onApprove,
  onDismissStale,
}: {
  fieldPath: string
  localeId: string
  cellState: FieldCellState
  isSource: boolean
  inFlight?: CellInFlightState
  currentSourceValue?: string
  onTranslate: (fieldPath: string, localeId: string) => void
  onApprove: (fieldPath: string, localeId: string) => void
  onDismissStale: (fieldPath: string, localeId: string) => void
}) {
  const {t} = useTranslation(l10nLocaleNamespace)

  if (inFlight?.status === 'translating') {
    return (
      <td style={{padding: '8px', textAlign: 'center'}}>
        <Tooltip
          content={
            <Box padding={2}>
              <Text size={1}>{t('field-translations.cell.translating')}</Text>
            </Box>
          }
          animate
          placement="bottom"
          portal
        >
          <Flex justify="center">
            <Spinner muted />
          </Flex>
        </Tooltip>
      </td>
    )
  }

  if (inFlight?.status === 'failed') {
    return (
      <td style={{padding: '8px', textAlign: 'center'}}>
        <Tooltip
          content={
            <Box padding={2}>
              <Text size={1}>{inFlight.error ?? t('field-translations.cell.failed')}</Text>
            </Box>
          }
          animate
          placement="bottom"
          portal
        >
          <Box
            style={{
              background: 'var(--card-badge-critical-fg-color)',
              borderRadius: '50%',
              cursor: 'pointer',
              height: 10,
              margin: '0 auto',
              width: 10,
            }}
            onClick={() => onTranslate(fieldPath, localeId)}
          />
        </Tooltip>
      </td>
    )
  }

  // Source locale
  if (isSource) {
    return (
      <td style={{padding: '8px', textAlign: 'center'}}>
        <Tooltip
          content={
            <Box padding={2}>
              <Text size={1}>{t('field-translations.cell.source')}</Text>
            </Box>
          }
          animate
          placement="bottom"
          portal
        >
          <Flex justify="center">
            <Box
              style={{
                background: 'var(--card-badge-suggest-fg-color)',
                border: '2px solid var(--card-badge-suggest-fg-color)',
                borderRadius: '50%',
                height: 10,
                width: 10,
              }}
            />
          </Flex>
        </Tooltip>
      </td>
    )
  }

  const display = getStatusDisplay(cellState.status === 'missing' ? 'missing' : cellState.status)

  // Stale — wrap in popover
  if (cellState.status === 'stale') {
    return (
      <td style={{padding: '8px', textAlign: 'center'}}>
        <StaleDiffPopover
          fieldPath={fieldPath}
          localeId={localeId}
          sourceSnapshot={cellState.sourceSnapshot}
          currentSourceValue={currentSourceValue}
          onDismiss={onDismissStale}
          onRetranslate={onTranslate}
        >
          <Flex justify="center">
            <Tooltip
              content={
                <Box padding={2}>
                  <Text size={1}>{t('field-translations.cell.click-review', {tooltip: t('status.stale.tooltip')})}</Text>
                </Box>
              }
              animate
              placement="bottom"
              portal
            >
              <Box style={{cursor: 'pointer'}}>
                <WorkflowDot status="stale" />
              </Box>
            </Tooltip>
          </Flex>
        </StaleDiffPopover>
      </td>
    )
  }

  // Needs review — click to approve
  if (cellState.status === 'needsReview') {
    return (
      <td
        style={{padding: '8px', textAlign: 'center', cursor: 'pointer'}}
        onClick={() => onApprove(fieldPath, localeId)}
      >
        <Tooltip
          content={
            <Box padding={2}>
              <Text size={1}>{t('field-translations.cell.click-approve', {tooltip: t('status.needs-review.tooltip')})}</Text>
            </Box>
          }
          animate
          placement="bottom"
          portal
        >
          <Flex justify="center">
            <WorkflowDot status="needsReview" />
          </Flex>
        </Tooltip>
      </td>
    )
  }

  // Missing — click to translate
  if (cellState.status === 'missing') {
    return (
      <td
        style={{padding: '8px', textAlign: 'center', cursor: 'pointer'}}
        onClick={() => onTranslate(fieldPath, localeId)}
      >
        <Tooltip
          content={
            <Box padding={2}>
              <Text size={1}>{t('field-translations.cell.click-translate')}</Text>
            </Box>
          }
          animate
          placement="bottom"
          portal
        >
          <Flex justify="center">
            <WorkflowDot status="missing" />
          </Flex>
        </Tooltip>
      </td>
    )
  }

  // Approved
  return (
    <td style={{padding: '8px', textAlign: 'center'}}>
      <Tooltip
        content={
          <Box padding={2}>
            <Text size={1}>{t('status.approved.tooltip')}</Text>
          </Box>
        }
        animate
        placement="bottom"
        portal
      >
        <Flex justify="center">
          <WorkflowDot status="approved" />
        </Flex>
      </Tooltip>
    </td>
  )
}

function FieldGroup({
  parent,
  fields,
  locales,
  cellStates,
  sourceLanguages,
  currentSourceValues,
  inFlightStates,
  onTranslateCell,
  onTranslateField,
  onApproveCell,
  onDismissStale,
}: {
  parent: string | null
  fields: InternationalizedFieldDescriptor[]
  locales: Language[]
  cellStates: Record<string, Record<string, FieldCellState>>
  sourceLanguages: FieldTranslationSnapshot['sourceLanguages']
  currentSourceValues: Record<string, string>
  inFlightStates: Record<string, CellInFlightState>
  onTranslateCell: (fieldPath: string, localeId: string) => void
  onTranslateField: (fieldPath: string) => void
  onApproveCell: (fieldPath: string, localeId: string) => void
  onDismissStale: (fieldPath: string, localeId: string) => void
}) {
  const {t} = useTranslation(l10nLocaleNamespace)

  return (
    <>
      {parent && (
        <tr>
          <td
            colSpan={locales.length + 2}
            style={{
              background: 'var(--card-code-bg-color)',
              borderBottom: '1px solid var(--card-border-color)',
              padding: '6px 12px',
            }}
          >
            <Text size={0} weight="semibold" muted>
              {parent.toUpperCase()}
            </Text>
          </td>
        </tr>
      )}
      {fields.map((field, i) => {
        const fieldCellStates = cellStates[field.displayPath] ?? {}
        const sourceLocale = sourceLanguages[field.displayPath]
        const fieldLabel = field.depth > 0 ? field.path[field.path.length - 1] : field.displayTitle
        const rowBg = i % 2 === 0 ? 'transparent' : 'var(--card-code-bg-color)'

        return (
          <tr
            key={field.displayPath}
            style={{
              borderBottom: '1px solid var(--card-border-color)',
              backgroundColor: rowBg,
            }}
          >
            <td
              style={{
                padding: '10px 12px',
                position: 'sticky',
                left: 0,
                background: rowBg === 'transparent' ? 'var(--card-bg-color)' : rowBg,
                zIndex: 1,
                whiteSpace: 'nowrap',
              }}
            >
              <Flex align="center" gap={2}>
                <Text size={1} weight="medium">
                  {fieldLabel}
                </Text>
                <Text size={0} muted>
                  {field.valueType}
                </Text>
              </Flex>
            </td>
            {locales.map((locale) => {
              const cellState = fieldCellStates[locale.id] ?? {status: 'missing'}
              const isSource = locale.id === sourceLocale
              const key = `${field.displayPath}::${locale.id}`
              const inFlight = inFlightStates[key]

              return (
                <CellStatus
                  key={locale.id}
                  fieldPath={field.displayPath}
                  localeId={locale.id}
                  cellState={cellState}
                  isSource={isSource}
                  inFlight={inFlight}
                  currentSourceValue={currentSourceValues[field.displayPath]}
                  onTranslate={onTranslateCell}
                  onApprove={onApproveCell}
                  onDismissStale={onDismissStale}
                />
              )
            })}
            <td style={{padding: '8px', whiteSpace: 'nowrap', width: 1}}>
              {sourceLocale && (
                <Tooltip
                  content={
                    <Box padding={2}>
                      <Text size={1}>{t('field-translations.cell.translate-field')}</Text>
                    </Box>
                  }
                  animate
                  placement="left"
                  portal
                >
                  <Button
                    icon={TranslateIcon}
                    mode="bleed"
                    fontSize={1}
                    padding={2}
                    onClick={() => onTranslateField(field.displayPath)}
                  />
                </Tooltip>
              )}
            </td>
          </tr>
        )
      })}
    </>
  )
}
