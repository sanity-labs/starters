/**
 * Status cards — the primary drill-down mechanism.
 *
 * One clickable card per status, navigating to `/translations?status=X`.
 * `usingFallback` folds into the Missing card rather than taking a slot.
 * Zero-count cards stay visible and muted: the point is the full taxonomy
 * ("nothing is stale — good"), not a shifting card count.
 */

import type {CardTone} from '@sanity/ui'

import {getStatusDisplay} from '@starter/l10n'
import {CheckmarkCircleIcon} from '@sanity/icons'
import {Box, Card, Flex, Heading, Stack, Text, Tooltip} from '@sanity/ui'
import {useCallback} from 'react'
import {useNavigate} from 'react-router-dom'

import type {StatusBreakdownEntry} from '../hooks/useStatusBreakdown'
import type {DashboardStatus} from '../lib/localizationRun'

// --- Constants ---

/** Low-volume threshold: suppress percentages below this count */
const LOW_VOLUME_THRESHOLD = 10

/** Card order. `usingFallback` is folded into Missing, so it gets no card. */
const STATUS_CARD_ORDER: DashboardStatus[] = [
  'translating',
  'missing',
  'needsReview',
  'stale',
  'approved',
]

/** `getStatusDisplay` speaks Badge tones; a Card takes its own set. */
const CARD_TONES: Record<DashboardStatus, CardTone> = {
  approved: 'positive',
  missing: 'critical',
  needsReview: 'caution',
  stale: 'caution',
  translating: 'primary',
  usingFallback: 'default',
}

// --- Types ---

interface StatusCardsProps {
  data: StatusBreakdownEntry[]
}

// --- Skeleton ---

export function StatusCardsSkeleton() {
  return (
    <Flex gap={3}>
      {Array.from({length: STATUS_CARD_ORDER.length}).map((_, i) => (
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
  label: string
  onClick: () => void
  percentage: number
  showPercentage: boolean
  status: DashboardStatus
}

function StatusCard({
  celebrate,
  count,
  label,
  onClick,
  percentage,
  showPercentage,
  status,
}: StatusCardProps) {
  const display = getStatusDisplay(status)
  const Icon = display.icon
  const isZero = count === 0

  const tooltipText = celebrate
    ? `All ${label.toLowerCase()} translations resolved!`
    : isZero
      ? `No ${label.toLowerCase()} translations`
      : `${count} ${label.toLowerCase()} translation${count !== 1 ? 's' : ''} — click to view list`

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
        tone={celebrate ? 'positive' : CARD_TONES[status]}
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
              <Text muted={isZero && !celebrate} size={2} weight="medium">
                {label}
              </Text>
            </Flex>
            {celebrate ? (
              <Text size={2} weight="medium">
                All caught up!
              </Text>
            ) : (
              <>
                <Heading muted={isZero} size={5}>
                  {count}
                </Heading>
                {showPercentage && (
                  <Text muted size={2}>
                    {percentage}%
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
    (status: DashboardStatus) => {
      navigate(`/translations?status=${status}`)
    },
    [navigate],
  )

  const entryByStatus = new Map<DashboardStatus, StatusBreakdownEntry>()
  for (const entry of data) {
    entryByStatus.set(entry.status, entry)
  }

  const total = data.reduce((sum, e) => sum + e.count, 0)
  const showPercentage = total >= LOW_VOLUME_THRESHOLD
  const fallbackCount = entryByStatus.get('usingFallback')?.count ?? 0

  return (
    <Flex gap={3}>
      {STATUS_CARD_ORDER.map((status) => {
        const entry = entryByStatus.get(status)
        if (!entry) return null

        // The Missing card owns the fallback count too — a fallback is still a gap.
        const isMissing = status === 'missing'
        const displayCount = isMissing ? entry.count + fallbackCount : entry.count
        const displayPercentage =
          isMissing && total > 0 ? Math.round((displayCount / total) * 100) : entry.percentage

        const shouldCelebrate =
          (status === 'missing' && displayCount === 0) ||
          (status === 'stale' && entry.count === 0) ||
          (status === 'approved' && entry.percentage === 100)

        return (
          <StatusCard
            celebrate={shouldCelebrate}
            count={displayCount}
            key={status}
            label={entry.label}
            onClick={() => handleCardClick(status)}
            percentage={displayPercentage}
            showPercentage={showPercentage}
            status={status}
          />
        )
      })}
    </Flex>
  )
}

export default StatusCards
