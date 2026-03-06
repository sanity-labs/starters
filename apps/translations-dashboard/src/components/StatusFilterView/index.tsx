/**
 * Status filter view -- TanStack Table rewrite with sortable columns.
 *
 * 4 columns: Document (sortable), Type (sortable), {Status} Locales (sortable
 * by count), Action (not sortable). Default sort: locales count descending
 * (worst gaps first).
 *
 * Batch CTA bar with inline release picker for missing/stale statuses.
 */

import type {TranslationWorkflowStatus} from '@starter/l10n'
import type {ReleaseDocument} from '@sanity/sdk'
import type {SortingState} from '@tanstack/react-table'

import {getStatusDisplay} from '@starter/l10n'
import {Card, Flex, Heading, Stack, Text} from '@sanity/ui'
import {flexRender, getCoreRowModel, getSortedRowModel, useReactTable} from '@tanstack/react-table'
import React, {useMemo, useState} from 'react'

import type {StatusFilteredDocument} from '../../hooks/useStatusFilteredDocuments'

import {BatchActionBar, CelebrationState, StatusSummaryCards} from './BatchActionBar'
import {buildColumns} from './columns'

/** Status-specific subtitle shown below the batch action bar */
const STATUS_SUBTITLES: Partial<Record<TranslationWorkflowStatus, string>> = {
  approved: 'These translations have been reviewed and approved.',
  needsReview: 'Open each document in Studio to review and approve translations.',
}

interface StatusFilterViewProps {
  /** Batch translation progress */
  batchProgress?: {completed: number; total: number} | null
  data: StatusFilteredDocument[]
  /** Whether a batch translation is in progress */
  isBatchTranslating?: boolean
  /** Callback for batch translate -- receives selected release ID */
  onBatchTranslate?: (targetReleaseId?: string) => void
  /** Active releases for the release picker */
  releases?: ReleaseDocument[]
  status: TranslationWorkflowStatus
  totalSlots: number
}

// --- Sort Header Styles ---

const thStyle = (sortable: boolean): React.CSSProperties => ({
  borderBottom: '1px solid var(--card-border-color)',
  cursor: sortable ? 'pointer' : 'default',
  padding: '8px 12px',
  textAlign: 'left',
  userSelect: 'none',
})

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  verticalAlign: 'middle',
}

// --- Status Filter View ---

function StatusFilterView({
  batchProgress,
  data,
  isBatchTranslating,
  onBatchTranslate,
  releases = [],
  status,
  totalSlots,
}: StatusFilterViewProps) {
  const display = getStatusDisplay(status)
  const Icon = display.icon

  // Release picker state
  const [selectedReleaseId, setSelectedReleaseId] = useState('')

  // TanStack Table setup
  const columns = useMemo(() => buildColumns(status), [status])
  const [sorting, setSorting] = useState<SortingState>([{desc: true, id: 'locales'}])

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {sorting},
  })

  // Celebration state: 0 documents for this status
  if (data.length === 0) {
    return (
      <Stack space={4}>
        <Stack space={3} style={{textAlign: 'center'}}>
          <Flex align="center" gap={2} justify="center">
            <Text size={3}>
              <Icon />
            </Text>
            <Heading size={3}>{display.label} Translations</Heading>
          </Flex>
        </Stack>
        <CelebrationState status={status} />
      </Stack>
    )
  }

  const subtitle = STATUS_SUBTITLES[status]

  return (
    <Stack space={4}>
      {/* Header */}
      <Stack space={3} style={{textAlign: 'center'}}>
        <Flex align="center" gap={2} justify="center">
          <Text size={3}>
            <Icon />
          </Text>
          <Heading size={3}>
            {display.label} Translation{totalSlots !== 1 ? 's' : ''}
          </Heading>
        </Flex>
      </Stack>

      {/* Summary cards */}
      <StatusSummaryCards data={data} status={status} totalSlots={totalSlots} />

      {/* Batch action bar with release picker (missing/stale only) */}
      <BatchActionBar
        batchProgress={batchProgress}
        isBatchTranslating={isBatchTranslating}
        onBatchTranslate={onBatchTranslate}
        releases={releases}
        selectedReleaseId={selectedReleaseId}
        setSelectedReleaseId={setSelectedReleaseId}
        status={status}
        totalSlots={totalSlots}
      />

      {/* Status-specific subtitle */}
      {subtitle && (
        <Text muted size={0}>
          {subtitle}
        </Text>
      )}

      {/* Document table -- TanStack Table with @sanity/ui rendering */}
      <Card border radius={2} style={{overflow: 'hidden'}}>
        <table style={{borderCollapse: 'collapse', width: '100%'}}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const ariaSort =
                    sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'

                  return (
                    <th
                      aria-sort={canSort ? ariaSort : undefined}
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      onKeyDown={(e) => {
                        if (canSort && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault()
                          header.column.getToggleSortingHandler()?.(e)
                        }
                      }}
                      role={canSort ? 'columnheader' : undefined}
                      style={{
                        ...thStyle(canSort),
                        width: header.id === 'type' ? 120 : header.id === 'action' ? 44 : undefined,
                      }}
                      tabIndex={canSort ? 0 : undefined}
                    >
                      <Text muted={!sorted} size={1} weight={sorted ? 'semibold' : 'medium'}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' ? ' ↑' : ''}
                        {sorted === 'desc' ? ' ↓' : ''}
                      </Text>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                style={{
                  background:
                    i % 2 === 0
                      ? 'var(--card-code-bg-color, rgba(255,255,255,0.02))'
                      : 'transparent',
                  borderBottom: '1px solid var(--card-border-color)',
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={tdStyle}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Stack>
  )
}

export default StatusFilterView
