/**
 * Stale Documents Section — alert area for documents with stale translations.
 *
 * Placement: Below charts, above Recent Changes.
 * Sorted by oldest staleness first (most urgent).
 * Hidden entirely when no stale documents exist.
 * Capped at 5 items with "View all" link.
 *
 * Reads stale data from the aggregate data layer.
 * The stale detection Sanity Function writes 'stale' status to
 * workflowStates on translation.metadata when base-language docs
 * are published.
 */

import {WarningOutlineIcon} from '@sanity/icons'
import {Badge, Box, Button, Card, Flex, Heading, Stack, Text} from '@sanity/ui'

import type {StaleDocumentEntry, StaleDocumentsResult} from '../hooks/useStaleDocuments'

import OpenInStudioButton from './OpenInStudioButton'

// --- Types ---

interface StaleDocumentsSectionProps {
  /** Called when "View all" is clicked */
  onViewAll?: () => void
  state: StaleDocumentsResult
  /** Total count of stale documents (may exceed displayed cap of 5) */
  totalStaleCount?: number
}

// --- Component ---

function StaleDocumentsSection({onViewAll, state, totalStaleCount}: StaleDocumentsSectionProps) {
  const {data} = state

  // Hidden when empty — don't celebrate the absence of problems
  if (data.length === 0) {
    return null
  }

  return (
    <Card border padding={4} radius={2} tone="caution">
      <Stack space={4}>
        {/* Header */}
        <Flex align="center" gap={2}>
          <Text size={1}>
            <WarningOutlineIcon />
          </Text>
          <Heading size={1}>Stale Translations</Heading>
          {data && data.length > 0 && (
            <Badge tone="caution">{totalStaleCount ?? data.length}</Badge>
          )}
        </Flex>

        {/* Stale document rows */}
        {data.length > 0 && (
          <Stack space={2}>
            {data.map((entry) => (
              <StaleDocumentRow entry={entry} key={entry.documentId} />
            ))}
          </Stack>
        )}

        {/* View all link */}
        {totalStaleCount && totalStaleCount > (data?.length ?? 0) && onViewAll && (
          <Box>
            <Button
              fontSize={1}
              mode="bleed"
              onClick={onViewAll}
              text={`View all ${totalStaleCount} stale documents`}
              tone="caution"
            />
          </Box>
        )}
      </Stack>
    </Card>
  )
}

// --- Row Component ---

function StaleDocumentRow({entry}: {entry: StaleDocumentEntry}) {
  const staleCount = entry.staleLocales.length
  const oldestStaleAt = entry.oldestStaleAt
  const timeAgo = oldestStaleAt ? formatTimeAgo(oldestStaleAt) : null

  return (
    <Card padding={3} radius={2}>
      <Flex align="center" gap={3}>
        {/* Document info */}
        <Box flex={1}>
          <Flex align="center" gap={2}>
            <OpenInStudioButton
              doc={{documentId: entry.documentId, documentType: entry.documentType}}
              text
              title={entry.documentId}
            />
            <Badge mode="outline" tone="default">
              {entry.documentType}
            </Badge>
          </Flex>
        </Box>

        {/* Stale locale flags */}
        <Flex align="center" gap={1}>
          {entry.staleLocales.slice(0, 6).map((locale) => (
            <Text key={locale.localeTag} muted size={0} title={locale.localeTag}>
              {locale.localeTag}
            </Text>
          ))}
          {staleCount > 6 && (
            <Text muted size={0}>
              +{staleCount - 6}
            </Text>
          )}
        </Flex>

        {/* Staleness age */}
        {timeAgo && (
          <Text muted size={0}>
            {timeAgo}
          </Text>
        )}

        {/* Stale count badge */}
        <Badge tone="caution">{staleCount} stale</Badge>
      </Flex>
    </Card>
  )
}

// --- Helpers ---

/**
 * Format an ISO timestamp as a human-readable "time ago" string.
 * Keeps it simple — no external dependency.
 */
function formatTimeAgo(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then

  if (Number.isNaN(diffMs) || diffMs < 0) return ''

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export default StaleDocumentsSection
