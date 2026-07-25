/**
 * Documents whose source moved while their run was open for review.
 *
 * Advisory by design: the run is not re-routed and nothing is blocked. The
 * section names the drift and links to the run where the reviewer decides.
 */

import {WarningOutlineIcon} from '@sanity/icons'
import {Badge, Box, Button, Card, Flex, Heading, Stack, Text} from '@sanity/ui'
import {useNavigate} from 'react-router-dom'

import type {StaleDocumentEntry, StaleDocumentsResult} from '../hooks/useStaleDocuments'

import OpenInStudioButton from './OpenInStudioButton'

// --- Types ---

interface StaleDocumentsSectionProps {
  state: StaleDocumentsResult
  /** Total count (may exceed the displayed cap) */
  totalStaleCount?: number
}

// --- Component ---

function StaleDocumentsSection({state, totalStaleCount}: StaleDocumentsSectionProps) {
  const {data} = state

  // Hidden when empty — don't celebrate the absence of problems
  if (data.length === 0) return null

  return (
    <Card border padding={4} radius={2} tone="caution">
      <Stack space={4}>
        <Flex align="center" gap={2}>
          <Text size={1}>
            <WarningOutlineIcon />
          </Text>
          <Heading size={1}>Source changed under review</Heading>
          <Badge tone="caution">{totalStaleCount ?? data.length}</Badge>
        </Flex>

        <Stack space={2}>
          {data.map((entry) => (
            <StaleDocumentRow entry={entry} key={entry.documentId} />
          ))}
        </Stack>
      </Stack>
    </Card>
  )
}

// --- Row Component ---

function StaleDocumentRow({entry}: {entry: StaleDocumentEntry}) {
  const navigate = useNavigate()
  const timeAgo = formatTimeAgo(entry.since)

  return (
    <Card padding={3} radius={2}>
      <Flex align="center" gap={3}>
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
            {/* A failed locale never blocks the rest — it is just named. */}
            {entry.hasFailedLocales && <Badge tone="critical">locale failed</Badge>}
          </Flex>
        </Box>

        <Flex align="center" gap={1}>
          {entry.locales.slice(0, 6).map((locale) => (
            <Text key={locale} muted size={0}>
              {locale}
            </Text>
          ))}
          {entry.locales.length > 6 && (
            <Text muted size={0}>
              +{entry.locales.length - 6}
            </Text>
          )}
        </Flex>

        {timeAgo && (
          <Text muted size={0}>
            {timeAgo}
          </Text>
        )}

        <Button
          fontSize={1}
          mode="bleed"
          onClick={() => navigate(`/runs/${entry.instanceId}`)}
          padding={2}
          text="View run"
        />
      </Flex>
    </Card>
  )
}

// --- Helpers ---

const relativeTime = new Intl.RelativeTimeFormat(undefined, {numeric: 'auto', style: 'narrow'})

/** Largest unit that fits, in seconds. `sanity`'s `useTimeAgo` needs the Studio i18n provider; this is an App SDK app. */
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  if (Number.isNaN(diffMs) || diffMs < 0) return ''

  const seconds = Math.floor(diffMs / 1000)
  const [unit, size] = UNITS.find(([, unitSeconds]) => seconds >= unitSeconds) ?? ['second', 1]
  return relativeTime.format(-Math.floor(seconds / size), unit)
}

export default StaleDocumentsSection
