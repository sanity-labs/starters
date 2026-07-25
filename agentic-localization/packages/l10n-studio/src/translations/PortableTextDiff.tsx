/**
 * Block-level Portable Text diff component.
 *
 * The alignment is `@starter/l10n`'s `diffBlockTexts` — `@sanity/diff` over the
 * blocks' plain text, which reports a reordered block through `hasMoved` rather
 * than as a removal plus an addition. Rendering only: changed blocks get a
 * per-block `InlineDiff`, added/removed/moved blocks get labelled badges,
 * unchanged neighbours stay as muted context, and non-adjacent groups are
 * separated by `· · ·`. Capped at 5 changed blocks with expand.
 */

import {Badge, Box, Card, Flex, Stack, Text} from '@sanity/ui'
import {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'sanity'

import type {BlockChange} from '@starter/l10n'

import {diffBlockTexts} from '@starter/l10n'
import {l10nLocaleNamespace} from '../i18n'
import {InlineDiff} from './InlineDiff'

const DEFAULT_MAX_BLOCKS = 5

interface PortableTextDiffProps {
  oldBlocks: unknown[]
  newBlocks: unknown[]
  /** Max changed blocks to show before truncation (default: 5) */
  maxBlocks?: number
}

const ADDED_TEXT_STYLE: React.CSSProperties = {
  backgroundColor: 'color-mix(in srgb, var(--card-badge-positive-bg-color) 20%, transparent)',
  borderRadius: 2,
  padding: '0 1px',
}

const REMOVED_TEXT_STYLE: React.CSSProperties = {
  backgroundColor: 'color-mix(in srgb, var(--card-badge-critical-bg-color) 20%, transparent)',
  textDecoration: 'line-through',
  borderRadius: 2,
  padding: '0 1px',
}

const CONTEXT_TRUNCATE_LENGTH = 100

/** Everything that is neither an unchanged neighbour nor a hunk marker. */
function isChange(row: BlockChange): boolean {
  return row.type !== 'context' && row.type !== 'separator'
}

function BlockDiffRow({blockDiff}: {blockDiff: BlockChange}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  // Separator — no block number, just a visual break between non-adjacent groups
  if (blockDiff.type === 'separator') {
    return (
      <Text size={1} muted style={{textAlign: 'center', letterSpacing: '0.3em'}}>
        · · ·
      </Text>
    )
  }

  return (
    <Flex gap={2} align="flex-start">
      <Box style={{flexShrink: 0, width: 32, textAlign: 'right'}}>
        <Text size={0} muted>
          ¶ {blockDiff.blockNumber}
        </Text>
      </Box>

      <Box flex={1}>
        {blockDiff.type === 'changed' && (
          <InlineDiff oldValue={blockDiff.oldText!} newValue={blockDiff.newText!} />
        )}

        {blockDiff.type === 'added' && (
          <Stack space={2}>
            <Badge tone="positive" fontSize={0}>
              {t('diff.block-added')}
            </Badge>
            <Text size={1} style={ADDED_TEXT_STYLE}>
              {blockDiff.newText}
            </Text>
          </Stack>
        )}

        {blockDiff.type === 'removed' && (
          <Stack space={2}>
            <Badge tone="critical" fontSize={0}>
              {t('diff.block-removed')}
            </Badge>
            <Text size={1} style={REMOVED_TEXT_STYLE}>
              {blockDiff.oldText}
            </Text>
          </Stack>
        )}

        {blockDiff.type === 'moved' && (
          <Stack space={2}>
            <Badge tone="primary" fontSize={0}>
              {t('diff.block-moved')}
            </Badge>
            <Text size={1} muted style={{lineHeight: 1.6}}>
              {blockDiff.newText}
            </Text>
          </Stack>
        )}

        {blockDiff.type === 'context' && (
          <Text size={1} muted style={{lineHeight: 1.6}}>
            {blockDiff.newText && blockDiff.newText.length > CONTEXT_TRUNCATE_LENGTH
              ? blockDiff.newText.slice(0, CONTEXT_TRUNCATE_LENGTH) + '…'
              : blockDiff.newText}
          </Text>
        )}
      </Box>
    </Flex>
  )
}

export function PortableTextDiff({
  oldBlocks,
  newBlocks,
  maxBlocks = DEFAULT_MAX_BLOCKS,
}: PortableTextDiffProps) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const [showAll, setShowAll] = useState(false)
  const toggleShowAll = useCallback(() => setShowAll((prev) => !prev), [])

  const blockDiffs = useMemo(() => diffBlockTexts(oldBlocks, newBlocks), [oldBlocks, newBlocks])

  // Count only actual changes for truncation — context and separators don't count
  const changeCount = useMemo(() => blockDiffs.filter(isChange).length, [blockDiffs])

  // Always call useMemo — hooks must not be called conditionally
  const visibleDiffs = useMemo(() => {
    if (showAll) return blockDiffs

    let changesIncluded = 0
    const result: BlockChange[] = []

    for (const diff of blockDiffs) {
      if (isChange(diff)) {
        changesIncluded++
        if (changesIncluded <= maxBlocks) result.push(diff)
      } else if (changesIncluded < maxBlocks) {
        result.push(diff)
      }
    }

    return result
  }, [blockDiffs, showAll, maxBlocks])

  if (changeCount === 0) {
    return (
      <Card padding={3} radius={2} tone="transparent" border>
        <Text size={1} muted>
          {t('diff.no-changes')}
        </Text>
      </Card>
    )
  }

  const hiddenCount = changeCount - maxBlocks

  return (
    <Stack space={3}>
      {visibleDiffs.map((blockDiff, idx) => (
        <BlockDiffRow
          key={`${blockDiff.type}-${blockDiff.blockNumber}-${idx}`}
          blockDiff={blockDiff}
        />
      ))}

      {hiddenCount > 0 && !showAll && (
        <Text
          size={1}
          role="button"
          style={{
            color: 'var(--card-link-color)',
            cursor: 'pointer',
            paddingLeft: 40,
          }}
          onClick={toggleShowAll}
        >
          {t('diff.more-changes', {count: hiddenCount})}
        </Text>
      )}
    </Stack>
  )
}
