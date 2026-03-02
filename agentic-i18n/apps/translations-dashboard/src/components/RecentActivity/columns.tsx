import type {TranslationWorkflowStatus} from '@starter/l10n'

import {getStatusDisplay} from '@starter/l10n'
import {Badge, Box, Card, Flex, Stack, Text, Tooltip} from '@sanity/ui'
import {createColumnHelper} from '@tanstack/react-table'

import {InitialsAvatar} from '../../lib/avatar'

// =============================================================================
// Row type for TanStack Table
// =============================================================================

export interface ActivityRow {
  documentTitle: string
  documentType: string
  id: string
  localeTag: string
  profileImage?: null | string
  timestamp: string
  transitionFrom: null | TranslationWorkflowStatus
  transitionTo: TranslationWorkflowStatus
  userId: null | string
  userName: string
}

// =============================================================================
// Helpers
// =============================================================================

export function formatRelativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then

  if (isNaN(then)) return ''

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

/** Document type labels (singular) — starter project only uses article */
const DOC_TYPE_LABELS: Record<string, string> = {
  article: 'Article',
}

function getDocTypeLabel(type: string): string {
  return DOC_TYPE_LABELS[type] || type
}

// =============================================================================
// Transition Badge — renders "From -> To" or just "To"
// =============================================================================

function TransitionBadge({
  from,
  to,
}: {
  from: null | TranslationWorkflowStatus
  to: TranslationWorkflowStatus
}) {
  const toDisplay = getStatusDisplay(to)

  if (!from) {
    return (
      <Badge mode="outline" tone={toDisplay.tone}>
        {toDisplay.label}
      </Badge>
    )
  }

  const fromDisplay = getStatusDisplay(from)

  return (
    <Flex align="center" gap={1} wrap="nowrap">
      <Badge mode="outline" padding={2} tone={fromDisplay.tone}>
        {fromDisplay.label}
      </Badge>
      <Text muted size={0}>
        →
      </Text>
      <Badge mode="outline" padding={2} tone={toDisplay.tone}>
        {toDisplay.label}
      </Badge>
    </Flex>
  )
}

// =============================================================================
// TanStack Table columns
// =============================================================================

const columnHelper = createColumnHelper<ActivityRow>()

export const columns = [
  columnHelper.accessor('timestamp', {
    cell: (info) => {
      const iso = info.getValue()
      const relative = formatRelativeTime(iso)
      return (
        <Tooltip
          animate
          content={
            <Box padding={2}>
              <Text size={1}>{new Date(iso).toLocaleString()}</Text>
            </Box>
          }
          delay={500}
          placement="top"
          portal
        >
          <Text muted size={1}>
            {relative}
          </Text>
        </Tooltip>
      )
    },
    header: 'Time',
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor('userName', {
    cell: (info) => {
      const name = info.getValue()
      const {profileImage} = info.row.original
      return (
        <Flex align="center" gap={2}>
          <InitialsAvatar name={name} profileImage={profileImage} />
          <Text size={1}>{name}</Text>
        </Flex>
      )
    },
    header: 'User',
  }),
  columnHelper.accessor('documentType', {
    cell: (info) => {
      const type = info.getValue()
      if (!type) return null
      return (
        <Badge mode="outline" padding={2} tone="primary">
          {getDocTypeLabel(type)}
        </Badge>
      )
    },
    header: 'Type',
  }),
  columnHelper.accessor('documentTitle', {
    cell: (info) => (
      <Text size={1} weight="medium">
        {info.getValue()}
      </Text>
    ),
    header: 'Document',
  }),
  columnHelper.accessor('localeTag', {
    cell: (info) => (
      <Badge mode="outline" padding={2} tone="primary">
        {info.getValue()}
      </Badge>
    ),
    header: 'Locale',
  }),
  columnHelper.display({
    cell: (info) => (
      <TransitionBadge
        from={info.row.original.transitionFrom}
        to={info.row.original.transitionTo}
      />
    ),
    enableSorting: false,
    header: 'Action',
    id: 'action',
  }),
]

// =============================================================================
// Table config
// =============================================================================

export const NOWRAP_COLUMNS = new Set([
  'timestamp',
  'userName',
  'documentType',
  'localeTag',
  'action',
])

export const COLUMN_WIDTHS: Record<string, number> = {
  action: 140,
  documentType: 120,
  localeTag: 90,
  timestamp: 80,
  userName: 140,
}

// =============================================================================
// Skeleton
// =============================================================================

export function RecentActivitySkeleton() {
  return (
    <Card padding={4} radius={2}>
      <Stack space={3}>
        <div className="skeleton" style={{height: 20, width: 160}} />
        <Flex gap={2}>
          <div className="skeleton" style={{height: 28, width: 100}} />
          <div className="skeleton" style={{height: 28, width: 100}} />
        </Flex>
        {Array.from({length: 5}).map((_, i) => (
          <Flex align="center" gap={3} key={i} padding={2}>
            <div className="skeleton" style={{height: 14, width: 48}} />
            <div className="skeleton" style={{height: 28, width: 28}} />
            <div className="skeleton" style={{flex: 1, height: 16, width: '100%'}} />
            <div className="skeleton" style={{height: 20, width: 50}} />
            <div className="skeleton" style={{height: 20, width: 96}} />
          </Flex>
        ))}
      </Stack>
    </Card>
  )
}
