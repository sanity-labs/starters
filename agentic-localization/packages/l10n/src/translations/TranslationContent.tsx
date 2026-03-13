/**
 * Shared translation UI content used by both the document view pane
 * and the document inspector. Contains all sub-components, sorting/selection
 * state, and the main table rendering.
 */

import {
  CheckmarkCircleIcon,
  CloseIcon,
  DatabaseIcon,
  PackageIcon,
  SparklesIcon,
  SpinnerIcon,
  TranslateIcon,
} from '@sanity/icons'
import {Badge, Box, Button, Card, Checkbox, Flex, Spinner, Stack, Text, Tooltip} from '@sanity/ui'
import {Suspense, use, useCallback, useMemo, useRef, useState} from 'react'
import {ErrorBoundary} from './ErrorBoundary'
import {
  DocumentStatusIndicator,
  getPublishedId,
  useDocumentVersionInfo,
  usePerspective,
  useTranslation,
} from 'sanity'
import {useRouter} from 'sanity/router'
import type {RouterPanes} from 'sanity/structure'

import {getStatusDisplay} from './getStatusDisplay'
import {TranslatedDocTaskCard} from './TranslatedDocTaskCard'
import type {
  LocaleTranslation,
  ResolvedTranslationsConfig,
  TranslationInFlightStatus,
  TranslationWorkflowStatus,
} from '../core/types'
import {l10nLocaleNamespace} from '../i18n'
import {useTranslateActions} from './useTranslateActions'
import {
  useTranslationPaneData,
  useBaseDocumentId,
  type TranslationPaneSnapshot,
} from './useTranslationPaneData'
import {useReleases} from './useReleases'

export interface TranslationContentProps {
  documentId: string
  documentType: string
  documentLanguage: string | undefined
  config: ResolvedTranslationsConfig
  onClose?: () => void
}

type SortColumn = 'language' | 'status'
type SortDirection = 'asc' | 'desc'

const STATUS_SORT_ORDER: Record<TranslationWorkflowStatus, number> = {
  missing: 0,
  stale: 1,
  needsReview: 2,
  usingFallback: 3,
  approved: 4,
}

const TRANSLATABLE_STATUSES: TranslationWorkflowStatus[] = ['missing', 'usingFallback', 'stale']

/**
 * Inline CSS injected once for container-query-based responsive badges
 * and interactive progress bar badge styles.
 */
const INJECTED_STYLES = `
  .translation-status-cell {
    container-type: inline-size;
  }
  .translation-status-label {
    display: inline;
  }
  @container (max-width: 90px) {
    .translation-status-label {
      display: none;
    }
  }
  .translation-progress-badge {
    cursor: pointer;
    transition: outline-color 0.15s ease, opacity 0.15s ease;
    outline: 2px solid transparent;
    outline-offset: 1px;
    border-radius: 999px;
  }
  .translation-progress-badge:hover {
    opacity: 0.85;
  }
  .translation-progress-badge[data-selected="true"] {
    outline-color: currentColor;
  }
  @keyframes translation-status-spin {
    to {
      transform: rotate(360deg);
    }
  }
  .translation-progress-fill {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.12);
    transform-origin: left;
    animation: translation-progress-grow 30s ease-out forwards;
    pointer-events: none;
    border-radius: inherit;
  }
  @keyframes translation-progress-grow {
    from { transform: scaleX(0); }
    to { transform: scaleX(0.7); }
  }
`

// --- Sub-components ---

function StackedProgressBar({
  locales,
  selectedStatuses,
  onToggleStatus,
}: {
  locales: LocaleTranslation[]
  selectedStatuses: Set<TranslationWorkflowStatus>
  onToggleStatus: (status: TranslationWorkflowStatus) => void
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const counts = useMemo(() => {
    const result = {
      missing: 0,
      needsReview: 0,
      usingFallback: 0,
      approved: 0,
      stale: 0,
      total: locales.length,
    }
    for (const locale of locales) {
      switch (locale.translationStatus) {
        case 'missing':
          result.missing++
          break
        case 'needsReview':
          result.needsReview++
          break
        case 'usingFallback':
          result.usingFallback++
          break
        case 'approved':
          result.approved++
          break
        case 'stale':
          result.stale++
          break
      }
    }
    return result
  }, [locales])

  if (counts.total === 0) return null

  const completedCount = counts.approved + counts.needsReview + counts.usingFallback
  const completedPercent = Math.round((completedCount / counts.total) * 100)

  const segments: Array<{count: number; fillColor: string}> = [
    {count: counts.approved, fillColor: 'var(--card-badge-positive-bg-color)'},
    {count: counts.needsReview, fillColor: 'var(--card-badge-caution-bg-color)'},
    {count: counts.stale, fillColor: 'var(--card-badge-caution-bg-color)'},
    {count: counts.usingFallback, fillColor: 'var(--card-badge-default-bg-color)'},
    {count: counts.missing, fillColor: 'var(--card-badge-critical-bg-color)'},
  ]

  const badges: Array<{
    status: TranslationWorkflowStatus
    count: number
    tone: 'positive' | 'caution' | 'default' | 'critical'
    label: string
    style?: React.CSSProperties
  }> = [
    {status: 'approved', count: counts.approved, tone: 'positive', label: t('status.approved.label')},
    {status: 'needsReview', count: counts.needsReview, tone: 'caution', label: t('status.needs-review.label')},
    {
      status: 'stale',
      count: counts.stale,
      tone: 'caution',
      label: t('status.stale.label'),
      style: {opacity: 0.75},
    },
    {
      status: 'usingFallback',
      count: counts.usingFallback,
      tone: 'default',
      label: t('status.fallback.label'),
    },
    {status: 'missing', count: counts.missing, tone: 'critical', label: t('status.missing.label')},
  ]

  return (
    <Card padding={3} radius={2} tone="neutral" border>
      <Stack space={3}>
        <Flex align="center" justify="space-between">
          <Text size={1} weight="semibold">
            {t('translations.progress', {completed: completedCount, total: counts.total})}
          </Text>
          <Text size={1} muted>
            {completedPercent}%
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
          {(() => {
            const visible = segments.filter((s) => s.count > 0)
            return visible.map((seg, i) => (
              <Box
                key={i}
                style={{
                  background: seg.fillColor,
                  borderRight: i < visible.length - 1 ? '1px solid rgba(0, 0, 0, 0.15)' : 'none',
                  height: '100%',
                  transition: 'width 0.3s ease',
                  width: `${(seg.count / counts.total) * 100}%`,
                }}
              />
            ))
          })()}
        </Box>

        <Flex gap={2} wrap="wrap">
          {badges.map(
            (b) =>
              b.count > 0 && (
                <Tooltip
                  key={b.status}
                  content={
                    <Box padding={2}>
                      <Text size={1}>{t('translations.select-all', {label: b.label})}</Text>
                    </Box>
                  }
                  animate
                  placement="bottom"
                  portal
                >
                  <Button
                    mode={selectedStatuses.has(b.status) ? 'default' : 'ghost'}
                    tone={b.tone}
                    style={b.style}
                    onClick={() => onToggleStatus(b.status)}
                    text={`${b.count} ${b.label}`}
                  />
                </Tooltip>
              ),
          )}
        </Flex>
      </Stack>
    </Card>
  )
}

function SortHeader({
  label,
  column,
  currentSort,
  currentDirection,
  onSort,
  style,
  index,
}: {
  label: string
  column: SortColumn
  currentSort: SortColumn
  currentDirection: SortDirection
  onSort: (col: SortColumn) => void
  style?: React.CSSProperties
  index: number
}) {
  const isActive = currentSort === column
  const arrow = isActive ? (currentDirection === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <th
      onClick={() => onSort(column)}
      style={{
        borderBottom: '1px solid var(--card-border-color)',
        cursor: 'pointer',
        fontWeight: 500,
        padding: '8px',
        textAlign: 'left',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <Text
        size={1}
        muted={!isActive}
        weight={isActive ? 'semibold' : 'medium'}
        style={{marginLeft: index === 0 ? '26px' : '0'}}
      >
        {label}
        {arrow}
      </Text>
    </th>
  )
}

function resolveDocStateLabel(
  draft: unknown,
  published: unknown,
  versions: unknown,
  t: (key: string) => string,
): string {
  if (published) return t('translations.doc-state.published')
  if (versions && Array.isArray(versions) && versions.length > 0) return t('translations.doc-state.in-release')
  if (draft) return t('translations.doc-state.draft')
  return t('translations.doc-state.missing')
}

function DocStatusDot({documentId}: {documentId: string}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const {draft, published, versions} = useDocumentVersionInfo(documentId)
  const label = resolveDocStateLabel(draft, published, versions, t)
  return (
    <Tooltip
      content={
        <Box padding={2}>
          <Text size={1}>{label}</Text>
        </Box>
      }
      animate
      placement="bottom"
      portal
    >
      <Box style={{flexShrink: 0, lineHeight: 0}}>
        <DocumentStatusIndicator draft={draft} published={published} versions={versions} />
      </Box>
    </Tooltip>
  )
}

function FallbackDocStatusDot({
  locale,
  allLocales,
  baseDocumentId,
}: {
  locale: LocaleTranslation
  allLocales: LocaleTranslation[]
  baseDocumentId: string
}) {
  const fallback = allLocales.find((l) => l.localeId === locale.fallbackLocale)
  if (fallback?.translatedDocumentId && fallback.documentState !== 'none') {
    return <DocStatusDot documentId={fallback.translatedDocumentId} />
  }
  // Fallback locale is the base language document (not in allLocales)
  return <DocStatusDot documentId={baseDocumentId} />
}

/**
 * Resolves the navigation target ID for a locale row click.
 * Returns a translated doc ID if one exists, or the fallback doc ID for
 * usingFallback locales.
 */
function getNavigationTarget(
  locale: LocaleTranslation,
  locales: LocaleTranslation[],
  t: (key: string, params?: Record<string, string | number>) => string,
): {targetId: string; tooltipLabel: string} | null {
  if (locale.translatedDocumentId && locale.documentState !== 'none') {
    return {targetId: locale.translatedDocumentId, tooltipLabel: t('translations.go-to')}
  }
  if (locale.translationStatus === 'usingFallback' && locale.fallbackLocale) {
    const fallback = locales.find((l) => l.localeId === locale.fallbackLocale)
    if (fallback?.translatedDocumentId && fallback.documentState !== 'none') {
      return {
        targetId: fallback.translatedDocumentId,
        tooltipLabel: t('translations.go-to-fallback', {locale: locale.fallbackLocale}),
      }
    }
  }
  return null
}

function StatusDot({
  locale,
  allLocales,
  baseDocumentId,
}: {
  locale: LocaleTranslation
  allLocales: LocaleTranslation[]
  baseDocumentId: string
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  if (locale.translationStatus === 'missing') {
    return (
      <Tooltip
        content={
          <Box padding={2}>
            <Text size={1}>{t('translations.status.missing')}</Text>
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
            height: 5,
            width: 5,
            flexShrink: 0,
          }}
        />
      </Tooltip>
    )
  }
  if (locale.translationStatus === 'usingFallback' && locale.fallbackLocale) {
    return (
      <FallbackDocStatusDot
        locale={locale}
        allLocales={allLocales}
        baseDocumentId={baseDocumentId}
      />
    )
  }
  if (locale.translatedDocumentId && locale.documentState !== 'none') {
    return <DocStatusDot documentId={locale.translatedDocumentId} />
  }
  return null
}

function StatusBadge({
  effectiveStatus,
  workflowStatus,
  inFlightStatus,
  inFlightError,
}: {
  effectiveStatus: TranslationWorkflowStatus | TranslationInFlightStatus
  workflowStatus?: TranslationWorkflowStatus
  inFlightStatus?: TranslationInFlightStatus
  inFlightError?: string
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const isInFlight = inFlightStatus === 'translating'
  const hasFailed = inFlightStatus === 'failed'
  const displayStatus = isInFlight && workflowStatus ? workflowStatus : effectiveStatus
  const display = getStatusDisplay(displayStatus)
  const Icon = display.icon
  const statusLabel = isInFlight ? t('translations.status.working') : display.label

  return (
    <td style={{padding: '8px', whiteSpace: 'nowrap', width: 1}}>
      <div>
        <Tooltip
          content={
            <Box padding={2}>
              <Text size={1}>{inFlightError ?? display.tooltip}</Text>
            </Box>
          }
          animate
          placement="bottom"
          portal
        >
          <Badge
            tone={isInFlight ? 'suggest' : display.tone}
            fontSize={1}
            padding={2}
            style={{
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {isInFlight && <span className="translation-progress-fill" />}
            <Flex align="center" gap={2}>
              {isInFlight ? (
                <SpinnerIcon
                  style={{
                    animation: 'translation-status-spin 0.5s linear infinite',
                    color: 'inherit',
                    height: '1em',
                    width: '1em',
                  }}
                />
              ) : (
                <Icon style={{color: 'inherit'}} />
              )}
              <span className="translation-status-label">{statusLabel}</span>
            </Flex>
          </Badge>
        </Tooltip>
        {hasFailed && inFlightError && (
          <Box marginTop={1}>
            <Text size={0} muted>
              {inFlightError}
            </Text>
          </Box>
        )}
      </div>
    </td>
  )
}

function LocaleRow({
  locale,
  allLocales,
  baseDocumentId,
  isSelected,
  onToggleSelect,
  inFlightStatus,
  inFlightError,
  onNavigate,
  index,
}: {
  locale: LocaleTranslation
  allLocales: LocaleTranslation[]
  baseDocumentId: string
  isSelected: boolean
  onToggleSelect: (localeId: string) => void
  inFlightStatus?: TranslationInFlightStatus
  inFlightError?: string
  onNavigate: (documentId: string) => void
  index: number
}) {
  const effectiveStatus = inFlightStatus ?? locale.translationStatus

  const isTranslatable =
    !inFlightStatus &&
    (locale.translationStatus === 'missing' ||
      locale.translationStatus === 'usingFallback' ||
      locale.translationStatus === 'stale')

  const isReviewable = !inFlightStatus && locale.translationStatus === 'needsReview'

  const isSelectable = isTranslatable || isReviewable

  const {t} = useTranslation(l10nLocaleNamespace)

  const isInFlight = inFlightStatus === 'translating'

  const navTarget = getNavigationTarget(locale, allLocales, t)

  const handleTitleClick = useCallback(() => {
    if (navTarget) {
      onNavigate(navTarget.targetId)
    }
  }, [navTarget, onNavigate])

  const handleRowClick = useCallback(() => {
    if (isSelectable) onToggleSelect(locale.localeId)
  }, [isSelectable, onToggleSelect, locale.localeId])

  const showCheckbox = true
  const showSubtitle = true
  const showFullName = true
  const rowClickable = false

  const rowBg = index % 2 === 0 ? 'var(--card-code-bg-color)' : 'transparent'

  const isClickable = !!navTarget && !inFlightStatus

  const checkboxPadding = '12px'
  const langCellPadding = showCheckbox ? '0' : '12px'

  return (
    <tr
      onClick={rowClickable ? handleRowClick : undefined}
      style={{
        borderBottom: '1px solid var(--card-border-color)',
        backgroundColor: rowBg,
        cursor: rowClickable && isSelectable ? 'pointer' : 'default',
      }}
    >
      {showCheckbox && (
        <td
          style={{
            paddingBlock: '12px',
            paddingInlineStart: checkboxPadding,
            width: 'fit-content',
          }}
        >
          {isSelectable ? (
            <Checkbox
              checked={isSelected}
              onChange={() => onToggleSelect(locale.localeId)}
              onClick={rowClickable ? (e: React.MouseEvent) => e.stopPropagation() : undefined}
            />
          ) : isInFlight ? (
            <Checkbox
              checked={false}
              disabled
              readOnly
              onChange={() => {
                /* no-op: readOnly checkbox */
              }}
            />
          ) : null}
        </td>
      )}

      <td
        style={{
          paddingBlock: showSubtitle ? '16px' : '12px',
          paddingInlineStart: langCellPadding,
          paddingInlineEnd: '8px',
        }}
      >
        <Flex align="center" gap={2}>
          {locale.flag && <Text size={4}>{locale.flag}</Text>}
          <StatusDot locale={locale} allLocales={allLocales} baseDocumentId={baseDocumentId} />
          {showFullName ? (
            <Stack space={2}>
              {isClickable && !rowClickable ? (
                <Tooltip
                  content={
                    <Box padding={2}>
                      <Text size={1}>{navTarget.tooltipLabel}</Text>
                    </Box>
                  }
                  animate
                  placement="bottom"
                  portal
                >
                  <Text
                    size={2}
                    weight="medium"
                    textOverflow="ellipsis"
                    style={{
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textDecorationColor: 'var(--card-border-color)',
                      textUnderlineOffset: 2,
                    }}
                    onClick={handleTitleClick}
                  >
                    {locale.localeTitle}
                  </Text>
                </Tooltip>
              ) : (
                <Text size={2} weight="medium" textOverflow="ellipsis">
                  {locale.localeTitle}
                </Text>
              )}
              {showSubtitle && (
                <Text size={1} muted>
                  {locale.localeId}
                </Text>
              )}
            </Stack>
          ) : (
            <Text size={2} weight="medium" textOverflow="ellipsis">
              {locale.localeId}
            </Text>
          )}
        </Flex>
      </td>

      <StatusBadge
        effectiveStatus={effectiveStatus}
        workflowStatus={locale.translationStatus}
        inFlightStatus={inFlightStatus}
        inFlightError={inFlightError}
      />
    </tr>
  )
}

function EmptyState({message}: {message: string}) {
  return (
    <Card padding={4}>
      <Flex align="center" gap={3} direction="column" justify="center" height="fill">
        <Text align="center" muted size={2}>
          <TranslateIcon />
        </Text>
        <Text align="center" muted size={1}>
          {message}
        </Text>
      </Flex>
    </Card>
  )
}

function LoadingState() {
  return (
    <Flex align="center" justify="center" style={{height: '100%', minHeight: 200}}>
      <Spinner muted />
    </Flex>
  )
}

export function ErrorState({message, onRetry}: {message: string; onRetry: () => void}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  return (
    <Card padding={4} tone="critical">
      <Stack space={3}>
        <Text align="center" size={1}>
          {message}
        </Text>
        <Flex justify="center">
          <Button text={t('retry')} tone="critical" mode="ghost" onClick={onRetry} fontSize={1} />
        </Flex>
      </Stack>
    </Card>
  )
}

// --- Main Content Component ---

export function TranslationContent({
  documentId,
  documentType,
  documentLanguage,
  config,
  onClose,
}: TranslationContentProps) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const isBaseLanguage = !config.defaultLanguage || documentLanguage === config.defaultLanguage
  const stylesInjected = useRef(false)

  if (!stylesInjected.current && typeof document !== 'undefined') {
    const style = document.createElement('style')
    style.textContent = INJECTED_STYLES
    document.head.appendChild(style)
    stylesInjected.current = true
  }

  const baseDocumentId = useBaseDocumentId(documentId, config.defaultLanguage, !isBaseLanguage)

  const effectiveDocumentId = isBaseLanguage ? documentId : (baseDocumentId ?? undefined)

  const {dataPromise, refresh} = useTranslationPaneData(effectiveDocumentId, config)

  if (!config.internationalizedTypes.includes(documentType)) {
    return <EmptyState message={t('translations.not-configured', {documentType})} />
  }

  if (!documentLanguage) {
    return (
      <EmptyState message={t('translations.no-language')} />
    )
  }

  if (!isBaseLanguage && baseDocumentId === undefined) {
    return <LoadingState />
  }

  if (!isBaseLanguage && !effectiveDocumentId) {
    return <EmptyState message={t('translations.no-base-document')} />
  }

  if (!dataPromise) {
    return <LoadingState />
  }

  return (
    <ErrorBoundary featureName="Translation Pane" onReset={refresh}>
      <Suspense fallback={<LoadingState />}>
        <TranslationContentInner
          dataPromise={dataPromise}
          refresh={refresh}
          documentId={documentId}
          documentType={documentType}
          documentLanguage={documentLanguage}
          config={config}
          effectiveDocumentId={effectiveDocumentId!}
          isBaseLanguage={isBaseLanguage}
          onClose={onClose}
        />
      </Suspense>
    </ErrorBoundary>
  )
}

/**
 * Inner component that consumes the data promise via use().
 * Suspended by the <Suspense> boundary in TranslationContent until the data resolves.
 * On refresh via startTransition, React keeps this component's current UI on screen.
 */
function TranslationContentInner({
  dataPromise,
  refresh,
  documentId,
  documentType,
  documentLanguage,
  config,
  effectiveDocumentId,
  isBaseLanguage,
  onClose,
}: {
  dataPromise: Promise<TranslationPaneSnapshot>
  refresh: () => void
  documentId: string
  documentType: string
  documentLanguage: string | undefined
  config: ResolvedTranslationsConfig
  effectiveDocumentId: string
  isBaseLanguage: boolean
  onClose?: () => void
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const {locales, metadataId, workflowStates, staleAnalysis} = use(dataPromise)

  const {selectedReleaseId} = usePerspective()

  const releases = useReleases()
  const releaseName =
    selectedReleaseId && releases
      ? (releases.find((r) => r.id === selectedReleaseId)?.title ?? selectedReleaseId)
      : null

  const router = useRouter()

  const navigateToDocument = useCallback(
    (targetDocumentId: string) => {
      const targetId = getPublishedId(targetDocumentId)

      const currentState = router.state as {panes?: RouterPanes}

      if (currentState?.panes && Array.isArray(currentState.panes)) {
        const newPane = [{id: targetId}]
        router.navigate({
          ...currentState,
          panes: [...currentState.panes, newPane],
        })
      } else {
        router.navigateIntent('edit', {id: targetId, type: documentType ?? ''})
      }
    },
    [router, documentType],
  )

  const {
    translateLocale,
    approveLocale,
    dismissStale,
    applyPreTranslation,
    applyAllPreTranslations,
    inFlightStates,
    isTranslating,
    metadataPermission,
  } = useTranslateActions(
    effectiveDocumentId,
    documentType,
    config.defaultLanguage ?? documentLanguage,
    locales,
    metadataId,
    config,
    refresh,
  )

  const [sortColumn, setSortColumn] = useState<SortColumn>('status')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedLocales, setSelectedLocales] = useState<Set<string>>(new Set())
  const handleSort = useCallback(
    (column: SortColumn) => {
      if (sortColumn === column) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortColumn(column)
        setSortDirection('asc')
      }
    },
    [sortColumn],
  )

  const toggleSelect = useCallback((localeId: string) => {
    setSelectedLocales((prev) => {
      const next = new Set(prev)
      if (next.has(localeId)) {
        next.delete(localeId)
      } else {
        next.add(localeId)
      }
      return next
    })
  }, [])

  const localeIdsByStatus = useMemo(() => {
    const map: Partial<Record<TranslationWorkflowStatus, string[]>> = {}
    for (const l of locales) {
      if (inFlightStates[l.localeId]) continue
      const arr = map[l.translationStatus] ?? []
      arr.push(l.localeId)
      map[l.translationStatus] = arr
    }
    return map
  }, [locales, inFlightStates])

  const selectedStatuses = useMemo(() => {
    const set = new Set<TranslationWorkflowStatus>()
    for (const [status, ids] of Object.entries(localeIdsByStatus)) {
      if (ids && ids.length > 0 && ids.every((id) => selectedLocales.has(id))) {
        set.add(status as TranslationWorkflowStatus)
      }
    }
    return set
  }, [localeIdsByStatus, selectedLocales])

  const toggleStatus = useCallback(
    (status: TranslationWorkflowStatus) => {
      const ids = localeIdsByStatus[status] ?? []
      setSelectedLocales((prev) => {
        const next = new Set(prev)
        const allSelected = ids.every((id) => next.has(id))
        for (const id of ids) {
          if (allSelected) next.delete(id)
          else next.add(id)
        }
        return next
      })
    },
    [localeIdsByStatus],
  )

  const selectedForTranslation = useMemo(
    () =>
      [...selectedLocales].filter((id) =>
        TRANSLATABLE_STATUSES.some((s) => (localeIdsByStatus[s] ?? []).includes(id)),
      ),
    [selectedLocales, localeIdsByStatus],
  )

  const selectedForReview = useMemo(
    () => [...selectedLocales].filter((id) => (localeIdsByStatus.needsReview ?? []).includes(id)),
    [selectedLocales, localeIdsByStatus],
  )

  const hasTranslatableSelected = selectedForTranslation.length > 0
  const hasReviewableSelected = selectedForReview.length > 0 && !hasTranslatableSelected

  const handlePrimaryAction = useCallback(() => {
    if (hasTranslatableSelected) {
      for (const localeId of selectedForTranslation) {
        translateLocale(localeId)
      }
      // Don't clear selection — in-flight locales change status after refresh,
      // which auto-deselects them from the derived selectedForTranslation set.
    } else if (hasReviewableSelected) {
      for (const localeId of selectedForReview) {
        approveLocale(localeId)
      }
    }
  }, [
    hasTranslatableSelected,
    hasReviewableSelected,
    selectedForTranslation,
    selectedForReview,
    translateLocale,
    approveLocale,
  ])

  const sortedLocales = useMemo(() => {
    const copy = [...locales]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortColumn) {
        case 'language':
          cmp = a.localeTitle.localeCompare(b.localeTitle)
          break
        case 'status':
          cmp =
            (STATUS_SORT_ORDER[a.translationStatus] ?? 99) -
            (STATUS_SORT_ORDER[b.translationStatus] ?? 99)
          break
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
    return copy
  }, [locales, sortColumn, sortDirection])

  const sourceDocPublishedId = useMemo(() => {
    if (!effectiveDocumentId) return undefined
    return getPublishedId(effectiveDocumentId)
  }, [effectiveDocumentId])

  // --- Single-locale task card for translated documents ---
  if (!isBaseLanguage) {
    const currentLocaleEntry = documentLanguage ? workflowStates[documentLanguage] : undefined

    return (
      <Flex direction="column" height="fill" overflow="hidden">
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
            {t('translations.title')}
          </Text>
          <Box flex={1} />
          {metadataId && (
            <Tooltip
              content={
                <Box padding={2}>
                  <Text size={1}>{t('translations.view-metadata')}</Text>
                </Box>
              }
              animate
              placement="bottom"
              portal
            >
              <Button
                aria-label={t('translations.view-metadata')}
                icon={DatabaseIcon}
                mode="bleed"
                onClick={() => navigateToDocument(metadataId)}
              />
            </Tooltip>
          )}
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
              <Button
                aria-label={t('close-inspector')}
                icon={CloseIcon}
                mode="bleed"
                onClick={onClose}
              />
            </Tooltip>
          )}
        </Flex>
        <Box flex={1} overflow="auto" padding={3}>
          <Stack space={4}>
            <TranslatedDocTaskCard
              localeId={documentLanguage!}
              workflowEntry={currentLocaleEntry}
              sourceDocPublishedId={sourceDocPublishedId}
              onNavigateToSource={() => {
                if (effectiveDocumentId) navigateToDocument(effectiveDocumentId)
              }}
              onApprove={() => approveLocale(documentLanguage!)}
              onDismiss={() => dismissStale(documentLanguage!)}
              onTranslate={() => translateLocale(documentLanguage!)}
              isTranslating={isTranslating}
              staleAnalysis={staleAnalysis}
              metadataId={metadataId}
              onApplyField={(fieldName, suggestedValue) =>
                applyPreTranslation(documentId!, fieldName, suggestedValue)
              }
              onApplyAll={(translations) => applyAllPreTranslations(documentId!, translations)}
              releaseName={releaseName ?? undefined}
              translatedDocumentId={documentId}
            />
          </Stack>
        </Box>
      </Flex>
    )
  }

  // --- Multi-locale overview for base-language documents ---

  const primaryActionCount = hasTranslatableSelected
    ? selectedForTranslation.length
    : hasReviewableSelected
      ? selectedForReview.length
      : 0
  const releaseSuffix = releaseName ? ` → ${releaseName}` : ''
  const primaryActionText = hasTranslatableSelected
    ? `Translate ${primaryActionCount} Selected${releaseSuffix}`
    : hasReviewableSelected
      ? `Approve ${primaryActionCount} Selected`
      : 'Select items to act on'
  const primaryActionIcon = hasTranslatableSelected
    ? SparklesIcon
    : hasReviewableSelected
      ? CheckmarkCircleIcon
      : undefined
  const primaryActionTone = hasTranslatableSelected
    ? 'suggest'
    : hasReviewableSelected
      ? 'positive'
      : ('default' as const)

  return (
    <Flex direction="column" height="fill" overflow="hidden">
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
          {t('translations.title')}
        </Text>
        <Box flex={1} />
        {metadataId && (
          <Tooltip
            content={
              <Box padding={2}>
                <Text size={1}>{t('translations.view-metadata')}</Text>
              </Box>
            }
            animate
            placement="bottom"
            portal
          >
            <Button
              aria-label={t('translations.view-metadata')}
              icon={DatabaseIcon}
              mode="bleed"
              onClick={() => navigateToDocument(metadataId)}
            />
          </Tooltip>
        )}
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
      <Box flex={1} overflow="auto" padding={3}>
        <Stack space={4}>
          {releaseName && (
            <Card tone="transparent" padding={3} radius={2} border>
              <Flex align="center" gap={2} aria-live="polite">
                <Text size={1} muted>
                  <PackageIcon />
                </Text>
                <Text size={1} muted>
                  {t('translations.working-in-release', {releaseName})}
                </Text>
              </Flex>
            </Card>
          )}

          <StackedProgressBar
            locales={locales}
            selectedStatuses={selectedStatuses}
            onToggleStatus={toggleStatus}
          />

          {locales.length === 0 ? (
            <Card padding={3} tone="transparent" border radius={2}>
              <Text size={1} muted align="center">
                {t('translations.no-locales')}
              </Text>
            </Card>
          ) : (
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
                          padding: '8px',
                          textAlign: 'center',
                          width: 36,
                        }}
                      />
                      <SortHeader
                        label={t('translations.header.language')}
                        column="language"
                        currentSort={sortColumn}
                        currentDirection={sortDirection}
                        onSort={handleSort}
                        index={0}
                      />
                      <SortHeader
                        label={t('translations.header.status')}
                        column="status"
                        currentSort={sortColumn}
                        currentDirection={sortDirection}
                        onSort={handleSort}
                        index={1}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLocales.map((locale, index) => {
                      const inflight = inFlightStates[locale.localeId]
                      return (
                        <LocaleRow
                          key={locale.localeId}
                          locale={locale}
                          allLocales={locales}
                          baseDocumentId={documentId}
                          isSelected={selectedLocales.has(locale.localeId)}
                          onToggleSelect={toggleSelect}
                          inFlightStatus={inflight?.status}
                          inFlightError={inflight?.error}
                          onNavigate={navigateToDocument}
                          index={index}
                        />
                      )
                    })}
                  </tbody>
                </table>
              </Box>
            </Card>
          )}
        </Stack>
      </Box>

      <Card
        padding={3}
        borderTop
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 1,
        }}
      >
        <Button
          fontSize={1}
          mode="default"
          onClick={handlePrimaryAction}
          text={primaryActionText}
          tone={primaryActionTone}
          disabled={primaryActionCount === 0 || isTranslating || metadataPermission === false}
          icon={primaryActionIcon}
          style={{width: '100%'}}
        />
      </Card>
    </Flex>
  )
}
