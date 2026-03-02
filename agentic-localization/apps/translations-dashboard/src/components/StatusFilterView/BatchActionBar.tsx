import type {TranslationWorkflowStatus} from '@starter/l10n'
import type {ReleaseDocument} from '@sanity/sdk'

import {getStatusDisplay} from '@starter/l10n'
import {
  CheckmarkCircleIcon,
  DocumentsIcon,
  EarthGlobeIcon,
  SparklesIcon,
  SpinnerIcon,
  TranslateIcon,
} from '@sanity/icons'
import {Button, Card, Flex, Label, Stack, Text} from '@sanity/ui'
import React, {useMemo} from 'react'

import type {StatusFilteredDocument} from '../../hooks/useStatusFilteredDocuments'

import ReleaseSelector from '../ReleaseSelector'
import SummaryCard from '../SummaryCard'

// --- Celebration Empty State ---

export function CelebrationState({status}: {status: TranslationWorkflowStatus}) {
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

// --- Skeleton ---

const skeletonBlock = (width: number | string, height: number): React.CSSProperties => ({
  animation: 'pulse 1.5s ease-in-out infinite',
  background: 'var(--card-border-color)',
  borderRadius: 4,
  height,
  width,
})

export function StatusFilterSkeleton() {
  return (
    <Stack space={3}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      <div style={skeletonBlock(280, 24)} />
      <div style={skeletonBlock(160, 16)} />
      <div style={skeletonBlock(200, 40)} />
      <Card border radius={2} style={{overflow: 'hidden'}}>
        {/* Table header skeleton */}
        <Flex padding={3} style={{borderBottom: '1px solid var(--card-border-color)'}}>
          <div style={{...skeletonBlock('40%', 14), flex: 1}} />
          <div style={skeletonBlock(80, 14)} />
          <div style={skeletonBlock(120, 14)} />
          <div style={skeletonBlock(40, 14)} />
        </Flex>
        {/* Row skeletons */}
        {Array.from({length: 5}).map((_, i) => (
          <Flex
            align="center"
            gap={3}
            key={i}
            padding={3}
            style={{borderBottom: '1px solid var(--card-border-color)'}}
          >
            <div style={{...skeletonBlock('40%', 16), flex: 1}} />
            <div style={skeletonBlock(80, 16)} />
            <div style={skeletonBlock(100, 16)} />
            <div style={skeletonBlock(28, 28)} />
          </Flex>
        ))}
      </Card>
    </Stack>
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
  status: TranslationWorkflowStatus
  totalSlots: number
}) {
  const topLocale = useMemo(() => computeTopLocale(data), [data])

  return (
    <Flex gap={3}>
      <SummaryCard icon={DocumentsIcon} label="Total Documents" value={data.length} />
      <SummaryCard icon={TranslateIcon} label="Missing Locales" value={totalSlots} />
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
const SpinningBatchIcon = () => <SpinnerIcon style={{animation: 'spin 0.5s linear infinite'}} />

interface BatchActionBarProps {
  batchProgress?: {completed: number; total: number} | null
  isBatchTranslating?: boolean
  onBatchTranslate?: (targetReleaseId?: string) => void
  releases?: ReleaseDocument[]
  selectedReleaseId: string
  setSelectedReleaseId: (id: string) => void
  status: TranslationWorkflowStatus
  totalSlots: number
}

export function BatchActionBar({
  batchProgress,
  isBatchTranslating,
  onBatchTranslate,
  releases = [],
  selectedReleaseId,
  setSelectedReleaseId,
  status,
  totalSlots,
}: BatchActionBarProps) {
  // Only missing and stale get batch CTAs
  if (status !== 'missing' && status !== 'stale') return null
  if (!onBatchTranslate) return null

  // Release name for CTA label suffix
  const selectedRelease = releases.find((r) => r.name === selectedReleaseId)
  const releaseSuffix =
    selectedRelease && selectedReleaseId
      ? ` → ${selectedRelease.metadata.title || selectedRelease.name}`
      : ''

  const label =
    status === 'missing'
      ? `Translate All Missing (${totalSlots})${releaseSuffix}`
      : `Re-translate All Stale (${totalSlots})${releaseSuffix}`

  const progressLabel = batchProgress
    ? `Translating ${batchProgress.completed} of ${batchProgress.total}...`
    : 'Translating...'

  const progressPercent =
    batchProgress && batchProgress.total > 0
      ? (batchProgress.completed / batchProgress.total) * 100
      : 0

  return (
    <Flex direction="column" gap={2}>
      <Flex align="center" gap={3}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <Flex direction="column" gap={2}>
          <Label size={2}>Action</Label>
          <Button
            disabled={isBatchTranslating || totalSlots === 0}
            fontSize={1}
            icon={isBatchTranslating ? SpinningBatchIcon : SparklesIcon}
            onClick={() => onBatchTranslate(selectedReleaseId || undefined)}
            padding={3}
            style={
              isBatchTranslating
                ? {
                    backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.14) ${progressPercent}%, transparent ${progressPercent}%)`,
                  }
                : undefined
            }
            text={isBatchTranslating ? progressLabel : label}
            tone="suggest"
          />
        </Flex>
        <ReleaseSelector
          disabled={isBatchTranslating}
          onSelectRelease={setSelectedReleaseId}
          releases={releases}
          selectedRelease={selectedReleaseId}
        />
      </Flex>
    </Flex>
  )
}
