/**
 * Summary bar — the top-level orientation component.
 *
 * Two hero metrics:
 * 1. Launch Readiness % (hero) = approved / total — "Can I ship?"
 * 2. Translated % (secondary) = (approved + needsReview + usingFallback + stale) / total — "How much work is left?"
 *
 * Low-volume threshold: below 10 visible docs → counts only, 10+ → counts + percentage.
 * Tooltip on hover shows full breakdown.
 *
 * Uses @sanity/ui Badge tones for color, pulled at runtime for dark mode compat.
 */

import {CheckmarkCircleIcon, TranslateIcon} from '@sanity/icons'
import {Box, Card, Flex, Heading, Stack, Text, Tooltip} from '@sanity/ui'

import type {TranslationSummary} from '../../hooks/useTranslationSummary'

// --- Types ---

interface SummaryBarProps {
  data: TranslationSummary
  selectedLocale?: null | string
  selectedLocaleName?: null | string
}

/** Low-volume threshold: suppress percentages below this count */
const LOW_VOLUME_THRESHOLD = 10

// --- Helpers ---

function formatMetric(count: number, total: number, showPercentage: boolean): string {
  if (showPercentage) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0
    return `${count} of ${total} (${pct}%)`
  }
  return `${count} of ${total}`
}

// --- Summary Bar ---

function SummaryBar({data, selectedLocale, selectedLocaleName}: SummaryBarProps) {
  const localeName = selectedLocaleName || selectedLocale
  const showPercentage = data.totalPossible >= LOW_VOLUME_THRESHOLD
  const translated = data.approved + data.needsReview + data.usingFallback + data.stale

  // Tooltip: full breakdown
  const breakdownTooltip = [
    `${data.approved} approved`,
    data.needsReview > 0 ? `${data.needsReview} awaiting review` : null,
    data.stale > 0 ? `${data.stale} stale` : null,
    data.usingFallback > 0 ? `${data.usingFallback} using fallback` : null,
    `${data.missing} missing`,
  ]
    .filter(Boolean)
    .join(' · ')

  const scopeLabel = localeName ? ` for ${localeName}` : ''

  return (
    <Flex gap={3}>
      {/* Hero: Launch Readiness */}
      <Tooltip
        animate
        content={
          <Box padding={2}>
            <Stack space={2}>
              <Text size={1} weight="semibold">
                Launch Readiness{scopeLabel}
              </Text>
              <Text muted size={1}>
                {formatMetric(data.approved, data.totalPossible, true)} approved
              </Text>
              <Text muted size={0}>
                {breakdownTooltip}
              </Text>
            </Stack>
          </Box>
        }
        delay={500}
        placement="bottom"
        portal
      >
        <Card flex={1} padding={4} radius={4} shadow={1} tone="positive">
          <Stack space={4}>
            <Heading size={5}>
              {showPercentage
                ? `${data.launchReadiness}%`
                : `${data.approved} of ${data.totalPossible}`}
            </Heading>
            <Flex align="center" gap={2}>
              <Text size={3}>
                <CheckmarkCircleIcon />
              </Text>
              <Text size={3} weight="medium">
                Approved and ready to publish
              </Text>
            </Flex>
          </Stack>
        </Card>
      </Tooltip>

      {/* Secondary: Translated */}
      <Tooltip
        animate
        content={
          <Box padding={2}>
            <Stack space={2}>
              <Text size={1} weight="semibold">
                Translated{scopeLabel}
              </Text>
              <Text muted size={1}>
                {formatMetric(translated, data.totalPossible, true)} have content
              </Text>
              <Text muted size={0}>
                {breakdownTooltip}
              </Text>
            </Stack>
          </Box>
        }
        delay={500}
        placement="bottom"
        portal
      >
        <Card border flex={1} padding={4} radius={4}>
          <Stack space={4}>
            <Heading size={5}>
              {showPercentage
                ? `${data.translatedPercentage}%`
                : `${translated} of ${data.totalPossible}`}
            </Heading>
            <Flex align="center" gap={2}>
              <Text size={3}>
                <TranslateIcon />
              </Text>
              <Text size={3} weight="medium">
                Translation Exists
              </Text>
            </Flex>
          </Stack>
        </Card>
      </Tooltip>

      {/* Status breakdown cards live in the StatusCards component */}
    </Flex>
  )
}

export default SummaryBar
