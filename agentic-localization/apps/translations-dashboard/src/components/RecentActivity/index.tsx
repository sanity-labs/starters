/**
 * Recent Activity section — TanStack Table rewrite with sortable columns.
 *
 * 6 columns: Time, User, Type, Document, Locale, Action.
 * Action column shows lifecycle transitions (e.g., "Review -> Approved")
 * using getStatusDisplay() for consistent tones across surfaces.
 *
 * Tabs: "Your Activity" (default when currentUserId exists) / "All Activity".
 * Uses @sanity/ui TabList/Tab/TabPanel for WAI-ARIA tabs pattern.
 *
 * Demo shim: USE_DEMO_DATA flag + DEMO_ACTIVITY_DATA const with real
 * titles for demo recording. Flip to false when live data flows.
 *
 * Avatar: Initials-only with deterministic color from name hash.
 * No title truncation — text wraps naturally.
 */

import type {SortingState} from '@tanstack/react-table'

import {Card, Flex, Heading, Stack, Tab, TabList, TabPanel, Text} from '@sanity/ui'
import {flexRender, getCoreRowModel, getSortedRowModel, useReactTable} from '@tanstack/react-table'
import {useCallback, useMemo, useState} from 'react'

import type {RecentChangeEntry} from '../../hooks/useRecentChanges'

import {DEMO_ACTIVITY_DATA, USE_DEMO_DATA} from '../../__fixtures__/demoActivityData'
import {formatDocId} from '../../lib/utils'
import {type ActivityRow, COLUMN_WIDTHS, columns, NOWRAP_COLUMNS} from './columns'

// =============================================================================
// Types
// =============================================================================

type ActivityTab = 'all' | 'yours'

interface RecentActivityProps {
  /** All recent changes (unfiltered) */
  allData: null | RecentChangeEntry[]
  /** Current user's ID for "Your Activity" filtering */
  currentUserId?: null | string
  /** Current user's display name (replaces demo name at runtime) */
  currentUserName?: null | string
  /** Current user's profile image URL (shown instead of initials for current user) */
  currentUserProfileImage?: null | string
  /** Recent changes filtered to current user */
  userData: null | RecentChangeEntry[]
}

// =============================================================================
// Row builders
// =============================================================================

function buildDemoRows(
  currentUserId?: null | string,
  currentUserName?: null | string,
  currentUserProfileImage?: null | string,
): ActivityRow[] {
  const now = Date.now()
  return DEMO_ACTIVITY_DATA.map((entry, i) => {
    const isCurrentUser = entry.isCurrentUser === true
    return {
      documentTitle: entry.documentTitle,
      documentType: entry.documentType,
      id: `demo-${i}`,
      localeTag: entry.localeTag,
      profileImage: isCurrentUser
        ? (currentUserProfileImage ?? entry.userAvatar ?? null)
        : (entry.userAvatar ?? null),
      timestamp: new Date(now - entry.hoursAgo * 60 * 60 * 1000).toISOString(),
      transitionFrom: entry.transitionFrom,
      transitionTo: entry.transitionTo,
      userId: isCurrentUser ? (currentUserId ?? null) : `other-${i}`,
      userName:
        isCurrentUser && currentUserName
          ? currentUserName.split(' ')[0] || currentUserName
          : entry.userName,
    }
  })
}

function buildLiveRows(entries: RecentChangeEntry[]): ActivityRow[] {
  return entries.map((entry, i) => ({
    documentTitle: entry.documentTitle ?? formatDocId(entry.documentId),
    documentType: entry.documentType ?? '',
    id: `${entry.documentId}-${entry.localeTag}-${i}`,
    localeTag: entry.localeTag,
    timestamp: entry.updatedAt,
    transitionFrom: null,
    transitionTo: entry.status,
    userId: entry.reviewedBy,
    userName: entry.reviewedBy ?? 'Unknown',
  }))
}

// =============================================================================
// Tab IDs (for aria-controls / aria-labelledby pairing)
// =============================================================================

const TAB_ALL_ID = 'recent-activity-tab-all'
const TAB_YOURS_ID = 'recent-activity-tab-yours'
const PANEL_ALL_ID = 'recent-activity-panel-all'
const PANEL_YOURS_ID = 'recent-activity-panel-yours'

// =============================================================================
// Activity Table — shared between both tabs
// =============================================================================

function ActivityTable({data, emptyMessage}: {data: ActivityRow[]; emptyMessage: string}) {
  const [sorting, setSorting] = useState<SortingState>([{desc: true, id: 'timestamp'}])

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
      <Card padding={4} radius={2} tone="default">
        <Flex align="center" className="min-h-[60px]" justify="center">
          <Text muted size={1}>
            {emptyMessage}
          </Text>
        </Flex>
      </Card>
    )
  }

  return (
    <Card border className="overflow-hidden" radius={2}>
      <table className="w-full border-collapse">
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
                    className={`border-b border-black/[0.06] px-4 py-3 text-left select-none ${canSort ? 'cursor-pointer' : ''}`}
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    onKeyDown={(e) => {
                      if (canSort && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        header.column.getToggleSortingHandler()?.(e)
                      }
                    }}
                    role={canSort ? 'columnheader' : undefined}
                    style={{padding: '12px 16px', width: COLUMN_WIDTHS[header.id]}}
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
              className={`border-b border-black/[0.06] ${i % 2 === 0 ? 'bg-black/[0.04]' : ''}`}
              key={row.id}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  className={`px-4 py-3 align-middle ${NOWRAP_COLUMNS.has(cell.column.id) ? 'whitespace-nowrap' : ''}`}
                  key={cell.id}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

// =============================================================================
// Main Component
// =============================================================================

function RecentActivity({
  allData,
  currentUserId,
  currentUserName,
  currentUserProfileImage,
  userData,
}: RecentActivityProps) {
  const hasUser = !!currentUserId

  const [activeTab, setActiveTab] = useState<ActivityTab>(hasUser ? 'yours' : 'all')

  const handleAllTab = useCallback(() => setActiveTab('all'), [])
  const handleYoursTab = useCallback(() => setActiveTab('yours'), [])

  const allRows = useMemo(() => {
    if (USE_DEMO_DATA) return buildDemoRows(currentUserId, currentUserName, currentUserProfileImage)
    if (!allData) return []
    return buildLiveRows(allData)
  }, [allData, currentUserId, currentUserName, currentUserProfileImage])

  const yourRows = useMemo(() => {
    if (USE_DEMO_DATA) {
      return allRows.filter((row) => row.userId === currentUserId)
    }
    if (!userData) return []
    return buildLiveRows(userData)
  }, [allRows, currentUserId, userData])

  return (
    <Card border padding={5} radius={4}>
      <Stack space={4}>
        <Heading align="center" size={2}>
          Recent Activity
        </Heading>

        <div className="flex justify-center">
          <TabList space={1}>
            {hasUser && (
              <Tab
                aria-controls={PANEL_YOURS_ID}
                id={TAB_YOURS_ID}
                label="Your Activity"
                onClick={handleYoursTab}
                selected={activeTab === 'yours'}
              />
            )}
            <Tab
              aria-controls={PANEL_ALL_ID}
              id={TAB_ALL_ID}
              label="All Activity"
              onClick={handleAllTab}
              selected={activeTab === 'all'}
            />
          </TabList>
        </div>

        {hasUser && (
          <TabPanel
            aria-labelledby={TAB_YOURS_ID}
            hidden={activeTab !== 'yours'}
            id={PANEL_YOURS_ID}
          >
            <ActivityTable
              data={yourRows}
              emptyMessage="No recent activity from you. Translations you approve or edit will appear here."
            />
          </TabPanel>
        )}

        <TabPanel aria-labelledby={TAB_ALL_ID} hidden={activeTab !== 'all'} id={PANEL_ALL_ID}>
          <ActivityTable
            data={allRows}
            emptyMessage="Translation activity appears here when documents are translated, reviewed, or approved."
          />
        </TabPanel>
      </Stack>
    </Card>
  )
}

export default RecentActivity
