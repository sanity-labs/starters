/**
 * Coverage heatmap — the hero visualization.
 *
 * Document type × locale matrix showing translation coverage.
 *
 * Percentage-based gradient: red → orange → yellow → green.
 * Thresholds are tuned to show meaningful visual steps.
 *
 * Cells are clickable — clicking navigates to the gap-closer route.
 */

import {Box, Card, Flex, Heading, Stack, Text, Tooltip} from '@sanity/ui'
import React, {useCallback} from 'react'

import type {CoverageCell, CoverageMatrixRow} from '../../hooks/useCoverageMatrix'

// --- Types ---

interface CoverageHeatmapProps {
  activeCell?: {documentType: string; locale: string}
  data: CoverageMatrixRow[]
  localeColumns: Array<{flag: string; tag: string; title: string}>
  onCellClick?: (documentType: string, locale: string) => void
}

// --- Heatmap Cell ---

interface HeatmapCellProps {
  cell: CoverageCell
  isActive?: boolean
  locale: {flag: string; tag: string; title: string}
  onClick?: () => void
  row: CoverageMatrixRow
}

/** Pastel gradient: red → orange → yellow → green (soft, non-dominant) */
const COVERAGE_STEPS = [
  {color: '#fecaca', max: 0, min: 0}, // Pastel red: no coverage
  {color: '#fed7aa', max: 24, min: 1}, // Pastel red-orange: barely started
  {color: '#fef08a', max: 49, min: 25}, // Pastel yellow: in progress
  {color: '#bbf7d0', max: 74, min: 50}, // Pastel lime: halfway+
  {color: '#86efac', max: 100, min: 75}, // Pastel green: good coverage
] as const

/**
 * Map coverage percentage to a distinct color step.
 * Uses red → orange → yellow → green for intuitive at-a-glance reading.
 */
function getCellStyle(cell: CoverageCell): React.CSSProperties {
  if (cell.total === 0) {
    return {backgroundColor: 'var(--card-bg-color)', opacity: 0.5}
  }

  const pct = cell.percentage
  const step = COVERAGE_STEPS.find((s) => pct >= s.min && pct <= s.max)
  const color = step?.color ?? COVERAGE_STEPS[0].color

  return {
    backgroundColor: color,
    color: '#1f2937',
  }
}

function getCellTooltip(
  row: CoverageMatrixRow,
  locale: {tag: string; title: string},
  cell: CoverageCell,
): string {
  const parts = [`${row.documentTypeLabel} in ${locale.title}:`]

  if (cell.approved > 0) parts.push(`${cell.approved} approved`)
  if (cell.needsReview > 0) parts.push(`${cell.needsReview} awaiting review`)
  if (cell.stale > 0) parts.push(`${cell.stale} stale`)
  if (cell.usingFallback > 0) parts.push(`${cell.usingFallback} using fallback`)
  if (cell.missing > 0) parts.push(`${cell.missing} missing`)

  return parts.join('\n')
}

function HeatmapCell({cell, isActive, locale, onClick, row}: HeatmapCellProps) {
  const tooltipText = getCellTooltip(row, locale, cell)

  return (
    <Tooltip
      animate
      content={
        <Box padding={2}>
          <Stack space={1}>
            {tooltipText.split('\n').map((line, i) => (
              <Text key={i} size={1}>
                {line}
              </Text>
            ))}
          </Stack>
        </Box>
      }
      delay={500}
      placement="top"
      portal
    >
      <button
        aria-label={`${row.documentTypeLabel} in ${locale.title}: ${cell.percentage}% translated${isActive ? ' (active filter)' : ''}`}
        className={`h-10 w-full cursor-pointer rounded outline-none transition-all duration-150 border-black/10 ease-in-out ${isActive ? 'border-2 border-card-focus' : 'border border-card-border/40'}`}
        onClick={onClick}
        style={getCellStyle(cell)}
        type="button"
      >
        <Text align="center" size={2} weight="bold">
          {cell.percentage}%
        </Text>
      </button>
    </Tooltip>
  )
}

// --- Skeleton ---

export function HeatmapSkeleton() {
  return (
    <Card padding={4} radius={2} tone="default">
      <Stack space={3}>
        <div className="skeleton" style={{height: 20, width: 160}} />
        <div style={{display: 'grid', gap: 8, gridTemplateColumns: '140px repeat(6, 1fr)'}}>
          {Array.from({length: 28}).map((_, i) => (
            <div className="skeleton" key={i} style={{height: 40, width: '100%'}} />
          ))}
        </div>
      </Stack>
    </Card>
  )
}

// --- Heatmap ---

function CoverageHeatmap({activeCell, data, localeColumns, onCellClick}: CoverageHeatmapProps) {
  const handleCellClick = useCallback(
    (documentType: string, locale: string) => {
      onCellClick?.(documentType, locale)
    },
    [onCellClick],
  )

  if (data.length === 0 || localeColumns.length === 0) {
    return (
      <Card padding={4} radius={2} tone="default">
        <Flex align="center" className="min-h-[120px]" direction="column" gap={2} justify="center">
          <Text muted size={1}>
            No coverage data available
          </Text>
          <Text muted size={0}>
            Add documents and locales to see the translation coverage heatmap.
          </Text>
        </Flex>
      </Card>
    )
  }

  return (
    <Card border padding={5} radius={4} tone="default">
      <Stack space={5}>
        <Heading align="center" size={2}>
          Translation Coverage
        </Heading>

        {/* Header row — locale flags + names */}
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: `140px repeat(${localeColumns.length}, 1fr)`,
          }}
        >
          {/* Empty corner cell */}
          <div />
          {localeColumns.map((locale) => (
            <Flex align="center" gap={1} justify="center" key={locale.tag}>
              <Text size={2}>{locale.flag}</Text>
              <Text muted size={3}>
                {locale.tag}
              </Text>
            </Flex>
          ))}

          {/* Data rows */}
          {data.map((row) => (
            <React.Fragment key={row.documentType}>
              {/* Row label */}
              <Flex align="center">
                <Text size={2} textOverflow="ellipsis" weight="medium">
                  {row.documentTypeLabel}
                </Text>
              </Flex>

              {/* Cells */}
              {localeColumns.map((locale) => {
                const cell = row.locales[locale.tag]
                if (!cell) return <div key={locale.tag} />

                const isActive =
                  activeCell?.documentType === row.documentType && activeCell?.locale === locale.tag

                return (
                  <HeatmapCell
                    cell={cell}
                    isActive={isActive}
                    key={locale.tag}
                    locale={locale}
                    onClick={() => handleCellClick(row.documentType, locale.tag)}
                    row={row}
                  />
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </Stack>
    </Card>
  )
}

export default CoverageHeatmap
