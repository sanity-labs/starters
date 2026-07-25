import type {ReleaseDocument} from '@sanity/sdk'

import {getStatusDisplay} from '@starter/l10n'
import {
  CheckmarkCircleIcon,
  DocumentsIcon,
  EarthGlobeIcon,
  SparklesIcon,
  SpinnerIcon,
} from '@sanity/icons'
import {Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {useMemo} from 'react'

import type {StatusFilteredDocument} from '../../hooks/useStatusFilteredDocuments'
import type {DashboardStatus} from '../../lib/localizationRun'
import type {CampaignTarget} from '../../hooks/useStartLocalization'

import ReleaseSelector from '../ReleaseSelector'
import SummaryCard from '../SummaryCard'

// --- Celebration Empty State ---

export function CelebrationState({status}: {status: DashboardStatus}) {
  const display = getStatusDisplay(status)

  return (
    <Card padding={5} radius={2} tone="positive">
      <Stack space={3} style={{textAlign: 'center'}}>
        <Text size={3}>
          <CheckmarkCircleIcon />
        </Text>
        <Text size={2} weight="semibold">
          All caught up!
        </Text>
        <Text muted size={1}>
          No {display.label.toLowerCase()} translations.
        </Text>
      </Stack>
    </Card>
  )
}

// --- Summary Cards ---

function computeTopLocale(
  data: StatusFilteredDocument[],
): {count: number; flag: string; tag: string} | null {
  const counts = new Map<string, {count: number; flag: string; tag: string}>()
  for (const doc of data) {
    for (const locale of doc.locales) {
      const existing = counts.get(locale.tag)
      if (existing) {
        existing.count++
      } else {
        counts.set(locale.tag, {count: 1, flag: locale.flag, tag: locale.tag})
      }
    }
  }
  if (counts.size === 0) return null
  let top: {count: number; flag: string; tag: string} | null = null
  for (const entry of counts.values()) {
    if (!top || entry.count > top.count) top = entry
  }
  return top
}

export function StatusSummaryCards({
  data,
  status,
  totalSlots,
}: {
  data: StatusFilteredDocument[]
  status: DashboardStatus
  totalSlots: number
}) {
  const topLocale = useMemo(() => computeTopLocale(data), [data])

  return (
    <Flex gap={3}>
      <SummaryCard icon={DocumentsIcon} label="Total Documents" value={data.length} />
      <SummaryCard icon={EarthGlobeIcon} label="Locales" value={totalSlots} />
      {topLocale && (status === 'missing' || status === 'stale') && (
        <SummaryCard
          icon={EarthGlobeIcon}
          label="Lowest Coverage"
          value={`${topLocale.flag} ${topLocale.tag}`}
        />
      )}
    </Flex>
  )
}

// --- Batch Action Bar ---

/** SpinnerIcon wrapper that spins -- for use as Button icon prop */
const SpinningBatchIcon = () => <SpinnerIcon className="spinner" />

/**
 * Only the statuses a run can act on get a CTA. `stale` is a source that moved
 * under an open review, so its run already exists — starting is a no-op that
 * ticks it, which is exactly what "re-check the source" means here.
 */
const STARTABLE: ReadonlySet<DashboardStatus> = new Set<DashboardStatus>([
  'missing',
  'stale',
  'usingFallback',
])

interface BatchActionBarProps {
  documentCount: number
  isStarting?: boolean
  onStart?: (target: CampaignTarget) => void
  releases?: ReleaseDocument[]
  setTarget: (target: CampaignTarget) => void
  status: DashboardStatus
  target: CampaignTarget
}

export function BatchActionBar({
  documentCount,
  isStarting,
  onStart,
  releases = [],
  setTarget,
  status,
  target,
}: BatchActionBarProps) {
  if (!STARTABLE.has(status)) return null
  if (!onStart) return null

  const label =
    status === 'stale'
      ? `Re-check ${documentCount} document${documentCount === 1 ? '' : 's'}`
      : `Localize ${documentCount} document${documentCount === 1 ? '' : 's'}`

  return (
    <Flex align="flex-end" gap={3} wrap="wrap">
      <Button
        disabled={isStarting || documentCount === 0}
        fontSize={1}
        icon={isStarting ? SpinningBatchIcon : SparklesIcon}
        onClick={() => onStart(target)}
        padding={3}
        text={label}
        tone="suggest"
      />
      <ReleaseSelector
        disabled={isStarting}
        onChange={setTarget}
        releases={releases}
        value={target}
      />
    </Flex>
  )
}
