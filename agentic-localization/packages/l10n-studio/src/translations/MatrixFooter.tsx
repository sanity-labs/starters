/**
 * The only verbs on this surface, and the machine's verdict compressed to fit
 * beside them.
 *
 * Materiality used to be the largest block on the panel — a heading and a
 * paragraph above the thing the reviewer came to read. It is a badge now, and
 * the analysis prose is one disclosure away. The two advisory flags collapse
 * into the same line: they qualify the decision, so they belong next to the
 * decision rather than four screens above it.
 *
 * Run narration is deliberately absent. `@sanity/workflow-studio-plugin` already
 * ships the stage strip above the form, the Workflows tab, the footer chip and a
 * per-instance history view; repeating the stage here was the fourth telling.
 */

import {ChevronDownIcon, ChevronUpIcon, ErrorOutlineIcon, SyncIcon} from '@sanity/icons'
import {Badge, Box, Button, Card, Flex, Stack, Text} from '@sanity/ui'
import type {ActivityEvaluation} from '@sanity/workflow-engine'
import {useState} from 'react'
import {useTranslation} from 'sanity'

import type {Materiality} from '@starter/l10n'

import {l10nLocaleNamespace} from '../i18n'
import {ReviewActions} from './ReviewActions'

const MATERIALITY_TONE: Record<Materiality, 'default' | 'caution' | 'critical'> = {
  cosmetic: 'default',
  minor: 'caution',
  material: 'critical',
}

export interface MatrixFooterProps {
  materiality: Materiality | null
  explanation: string | null
  sourceChanged: boolean
  /** The run reads drafts, so it cannot tell its own output from a source edit. */
  driftUnreliable: boolean
  failedCount: number
  activity: ActivityEvaluation | undefined
  locales: readonly string[]
  requestChangesFor: readonly string[] | null
  onRequestChangesFor: (locales: readonly string[] | null) => void
  onFire: (args: {action: string; params?: Record<string, unknown>}) => Promise<unknown>
}

export function MatrixFooter({
  materiality,
  explanation,
  sourceChanged,
  driftUnreliable,
  failedCount,
  activity,
  locales,
  requestChangesFor,
  onRequestChangesFor,
  onFire,
}: MatrixFooterProps) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const [open, setOpen] = useState(false)

  const flags = [
    sourceChanged
      ? t(driftUnreliable ? 'matrix.flag.drift-unreliable' : 'matrix.flag.source-changed')
      : null,
    failedCount > 0 ? t('matrix.flag.failed-locales', {count: failedCount}) : null,
  ].filter((flag): flag is string => flag !== null)

  const hasDisclosure = Boolean(explanation) || flags.length > 0
  if (!materiality && !hasDisclosure && !activity) return null

  return (
    <Card borderTop padding={3} style={{position: 'sticky', bottom: 0, zIndex: 3}}>
      <Stack space={3}>
        {(materiality || hasDisclosure) && (
          <Flex align="center" gap={2}>
            {sourceChanged && (
              <Text size={1}>
                <SyncIcon />
              </Text>
            )}
            {failedCount > 0 && (
              <Text size={1} style={{color: 'var(--card-badge-critical-fg-color)'}}>
                <ErrorOutlineIcon />
              </Text>
            )}
            {materiality && (
              <Badge fontSize={0} mode="outline" tone={MATERIALITY_TONE[materiality]}>
                {t(`matrix.materiality.${materiality}`)}
              </Badge>
            )}
            <Text muted size={0} textOverflow="ellipsis">
              {flags[0] ?? ''}
            </Text>
            <Box flex={1} />
            {hasDisclosure && (
              <Button
                aria-expanded={open}
                aria-label={t('matrix.materiality.explain')}
                fontSize={0}
                icon={open ? ChevronUpIcon : ChevronDownIcon}
                mode="bleed"
                onClick={() => setOpen((current) => !current)}
                padding={1}
              />
            )}
          </Flex>
        )}

        {open && (
          <Stack space={2}>
            {flags.map((flag) => (
              <Text key={flag} muted size={1}>
                {flag}
              </Text>
            ))}
            {explanation && <Text size={1}>{explanation}</Text>}
          </Stack>
        )}

        {activity && (
          <ReviewActions
            activity={activity}
            locales={locales}
            onFire={onFire}
            onRequestChangesFor={onRequestChangesFor}
            requestChangesFor={requestChangesFor}
          />
        )}
      </Stack>
    </Card>
  )
}
