/**
 * Status filter view — the drill-down from a status card.
 *
 * Sortable table plus, for the statuses a run can act on, one batch CTA and the
 * "ships as" picker that decides whether the batch becomes N document runs or
 * one campaign.
 */

import type {ReleaseDocument} from '@sanity/sdk'
import type {SortingState} from '@tanstack/react-table'

import {getStatusDisplay} from '@starter/l10n'
import {Card, Flex, Heading, Stack, Text} from '@sanity/ui'
import {flexRender, getCoreRowModel, getSortedRowModel, useReactTable} from '@tanstack/react-table'
import React, {useMemo, useState} from 'react'

import type {StatusFilteredDocument} from '../../hooks/useStatusFilteredDocuments'
import type {DashboardStatus} from '../../lib/localizationRun'
import type {CampaignTarget} from '../../hooks/useStartLocalization'

import {STATUS_ICONS} from '../../lib/statusIcons'
import {BatchActionBar, CelebrationState, StatusSummaryCards} from './BatchActionBar'
import {buildColumns} from './columns'

/** Status-specific subtitle shown below the batch action bar */
const STATUS_SUBTITLES: Partial<Record<DashboardStatus, string>> = {
  approved: 'These translations have been reviewed and approved.',
  needsReview: 'Open the run to review and approve, or review in Studio.',
  stale: 'The source moved while these runs were open for review. The reviewer decides.',
  translating: 'The engine is working on these. Open a run to watch it.',
}

interface StatusFilterViewProps {
  data: StatusFilteredDocument[]
  isStarting?: boolean
  onStart?: (target: CampaignTarget) => void
  releases?: ReleaseDocument[]
  status: DashboardStatus
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
  data,
  isStarting,
  onStart,
  releases = [],
  status,
  totalSlots,
}: StatusFilterViewProps) {
  const display = getStatusDisplay(status)
  const Icon = STATUS_ICONS[display.icon]

  const [target, setTarget] = useState<CampaignTarget>({kind: 'drafts'})

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

      <StatusSummaryCards data={data} status={status} totalSlots={totalSlots} />

      <BatchActionBar
        documentCount={data.length}
        isStarting={isStarting}
        onStart={onStart}
        releases={releases}
        setTarget={setTarget}
        status={status}
        target={target}
      />

      {subtitle && (
        <Text muted size={0}>
          {subtitle}
        </Text>
      )}

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
                        width:
                          header.id === 'type' ? 120 : header.id === 'action' ? 120 : undefined,
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
