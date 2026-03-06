/**
 * Status cards — the primary drill-down mechanism.
 *
 * 4 clickable cards, one per workflow status. Each card shows count + percentage
 * and navigates to /translations?status=X.
 *
 * "usingFallback" is folded into the Missing card as a sub-line to avoid
 * a 5th card crowding the row.
 *
 * Zero-count cards render as ghost/muted (not clickable) — shows the full
 * taxonomy so users see "oh, nothing is stale — good" rather than a shifting
 * card count.
 *
 * Data source: useStatusBreakdown (already computes count/label/tone per status).
 * Design tokens: getStatusDisplay() for icons/labels/tones — single source of truth.
 */

import type {TranslationWorkflowStatus} from '@starter/l10n'
import type {CardTone} from '@sanity/ui'

import {getStatusDisplay} from '@starter/l10n'
import {CheckmarkCircleIcon} from '@sanity/icons'
import {Box, Card, Flex, Heading, Stack, Text, Tooltip} from '@sanity/ui'
import {useCallback} from 'react'
import {useNavigate} from 'react-router-dom'

import type {StatusBreakdownEntry} from '../hooks/useStatusBreakdown'

// --- Constants ---

/** Low-volume threshold: suppress percentages below this count */
const LOW_VOLUME_THRESHOLD = 10

/**
 * Card display order and config. "usingFallback" is not a card —
 * its count is folded into the Missing card as a sub-line.
 */
const STATUS_CARD_ORDER: TranslationWorkflowStatus[] = [
  'missing',
  'needsReview',
  'stale',
  'approved',
]

// --- Types ---

interface StatusCardsProps {
  data: StatusBreakdownEntry[]
}

// --- Skeleton ---

export function StatusCardsSkeleton() {
  return (
    <Flex gap={3}>
      {Array.from({length: 4}).map((_, i) => (
        <Card flex={1} key={i} padding={3} radius={2}>
          <Stack space={2}>
            <div className="skeleton" style={{height: 14, width: 80}} />
            <div className="skeleton" style={{height: 28, width: 48}} />
            <div className="skeleton" style={{height: 12, width: 40}} />
          </Stack>
        </Card>
      ))}
    </Flex>
  )
}

// --- Single Card ---

interface StatusCardProps {
  /** Show celebration state (positive tone + "All caught up!") */
  celebrate?: boolean
  count: number
  /** Extra sub-line (e.g., "4 with fallback" on the Missing card) */
  fallbackCount?: number
  label: string
  onClick: () => void
  percentage: number
  showPercentage: boolean
  status: TranslationWorkflowStatus
  tone: string
}

function StatusCard({
  celebrate,
  count,
  fallbackCount,
  label,
  onClick,
  percentage,
  showPercentage,
  status,
  tone,
}: StatusCardProps) {
  const display = getStatusDisplay(status)
  const Icon = display.icon
  const isZero = count === 0 && (!fallbackCount || fallbackCount === 0)

  const tooltipText = celebrate
    ? `All ${label.toLowerCase()} translations resolved!`
    : isZero
      ? `No ${label.toLowerCase()} translations`
      : `${count} ${label.toLowerCase()} translation${count !== 1 ? 's' : ''}${
          fallbackCount && fallbackCount > 0 ? ` · ${fallbackCount} covered by fallback` : ''
        } — click to view list`

  return (
    <Tooltip
      animate
      content={
        <Box padding={2}>
          <Text size={1}>{tooltipText}</Text>
        </Box>
      }
      delay={500}
      placement="bottom"
      portal
    >
      <Card
        border
        className={`text-left transition-[box-shadow] duration-150 ease-in-out ${isZero && !celebrate ? 'opacity-50' : ''} ${!isZero ? 'cursor-pointer' : ''}`}
        flex={1}
        padding={4}
        radius={4}
        tone={celebrate ? 'positive' : (tone as CardTone)}
      >
        <button
          aria-label={`${count} ${label} translations${showPercentage ? `, ${percentage} percent` : ''}${isZero ? '' : ' — click to view list'}`}
          className={`block w-full border-none bg-none p-0 text-left ${!isZero ? 'cursor-pointer' : ''}`}
          disabled={isZero}
          onClick={isZero ? undefined : onClick}
          type="button"
        >
          <Stack space={4}>
            <Flex align="center" gap={2}>
              {celebrate ? (
                <Text size={3} style={{color: 'var(--card-positive-fg-color)'}}>
                  <CheckmarkCircleIcon />
                </Text>
              ) : (
                <Text muted={isZero} size={3}>
                  <Icon />
                </Text>
              )}
              <Text muted={isZero && !celebrate} size={3} weight="medium">
                {label}
              </Text>
            </Flex>
            {celebrate ? (
              <Text size={3} weight="medium">
                All caught up!
              </Text>
            ) : (
              <>
                <Heading muted={isZero} size={5}>
                  {count}
                </Heading>
                {showPercentage && (
                  <Text muted size={3}>
                    {percentage}%
                  </Text>
                )}
                {fallbackCount !== undefined && fallbackCount > 0 && (
                  <Text muted size={3}>
                    {fallbackCount} with fallback
                  </Text>
                )}
              </>
            )}
          </Stack>
        </button>
      </Card>
    </Tooltip>
  )
}

// --- Status Cards ---

function StatusCards({data}: StatusCardsProps) {
  const navigate = useNavigate()

  const handleCardClick = useCallback(
    (status: TranslationWorkflowStatus) => {
      navigate(`/translations?status=${status}`)
    },
    [navigate],
  )

  // Build lookup for quick access
  const entryByStatus = new Map<TranslationWorkflowStatus, StatusBreakdownEntry>()
  for (const entry of data) {
    entryByStatus.set(entry.status, entry)
  }

  // Total for low-volume threshold
  const total = data.reduce((sum, e) => sum + e.count, 0)
  const showPercentage = total >= LOW_VOLUME_THRESHOLD

  // Get the usingFallback count to fold into Missing card
  const fallbackEntry = entryByStatus.get('usingFallback')
  const fallbackCount = fallbackEntry?.count ?? 0

  return (
    <Flex gap={3}>
      {STATUS_CARD_ORDER.map((status) => {
        const entry = entryByStatus.get(status)
        if (!entry) return null

        // Missing card includes usingFallback count in its total display
        const isMissing = status === 'missing'
        const displayCount = isMissing ? entry.count + fallbackCount : entry.count
        const displayPercentage = isMissing
          ? total > 0
            ? Math.round((displayCount / total) * 100)
            : 0
          : entry.percentage

        // Celebration: missing=0 and stale=0 are wins worth celebrating.
        // approved at 100% is also a win. needsReview=0 is neutral (ghost).
        const shouldCelebrate =
          (status === 'missing' && displayCount === 0) ||
          (status === 'stale' && entry.count === 0) ||
          (status === 'approved' && entry.percentage === 100)

        return (
          <StatusCard
            celebrate={shouldCelebrate}
            count={displayCount}
            fallbackCount={0}
            key={status}
            label={entry.label}
            onClick={() => handleCardClick(status)}
            percentage={displayPercentage}
            showPercentage={showPercentage}
            status={status}
            tone={entry.tone}
          />
        )
      })}
    </Flex>
  )
}

export default StatusCards
