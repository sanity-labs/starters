/**
 * Block-level Portable Text diff component.
 *
 * Flattens PT blocks to plain text, uses jsdiff's diffArrays (LCS algorithm)
 * for proper sequence alignment, and renders per-block InlineDiff for changed
 * blocks. Added/removed blocks get labeled badges. Capped at 5 changed blocks
 * with expand.
 *
 * Adjacent removed+added chunks are merged into 'changed' entries so edited
 * blocks show word-level inline diffs instead of separate red/green blocks.
 *
 * Context blocks (1 unchanged before + 1 after each change group) provide
 * orientation. Non-adjacent groups are separated by `· · ·` dividers.
 *
 * Per @ux: "Translators need 'what words changed?', not 'which marks changed?'"
 * — so we diff plain text content, ignoring marks/annotations.
 */

import {Badge, Box, Card, Flex, Stack, Text} from '@sanity/ui'
import {diffArrays} from 'diff'
import {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'sanity'

import {extractBlockText} from '../core/extractBlockText'
import {l10nLocaleNamespace} from '../i18n'
import {InlineDiff} from './InlineDiff'

// --- Constants ---

const DEFAULT_MAX_BLOCKS = 5

// --- Types ---

interface PortableTextDiffProps {
  oldBlocks: unknown[]
  newBlocks: unknown[]
  /** Max changed blocks to show before truncation (default: 5) */
  maxBlocks?: number
}

interface BlockDiff {
  /** 1-based block index from the longer array */
  blockNumber: number
  type: 'changed' | 'added' | 'removed' | 'context' | 'separator'
  oldText?: string
  newText?: string
}

/**
 * Compute block-level diffs between two PT arrays.
 * Uses jsdiff's diffArrays (LCS algorithm) for proper sequence alignment —
 * handles insertions, deletions, and reordering without cascading false positives.
 *
 * Three-pass pipeline:
 * 1. diffArrays → raw entries (added/removed/unchanged) with block numbering
 * 2. Merge adjacent removed+added → 'changed' for word-level InlineDiff
 * 3. Context injection: 1 unchanged block before + 1 after each change group,
 *    separators between non-adjacent groups, drop remaining unchanged
 */
function computeBlockDiffs(oldBlocks: unknown[], newBlocks: unknown[]): BlockDiff[] {
  const oldTexts = oldBlocks.map(extractBlockText)
  const newTexts = newBlocks.map(extractBlockText)

  const arrayChanges = diffArrays(oldTexts, newTexts)

  // --- Pass 1: collect all blocks including unchanged ---
  const rawDiffs: BlockDiff[] = []
  let blockNumber = 0

  for (const change of arrayChanges) {
    if (change.added) {
      for (const text of change.value) {
        blockNumber++
        rawDiffs.push({blockNumber, type: 'added', newText: text})
      }
    } else if (change.removed) {
      for (const text of change.value) {
        blockNumber++
        rawDiffs.push({blockNumber, type: 'removed', oldText: text})
      }
    } else {
      // Unchanged — emit as 'context' (will be filtered in pass 3)
      for (const text of change.value) {
        blockNumber++
        rawDiffs.push({blockNumber, type: 'context', newText: text})
      }
    }
  }

  // --- Pass 2: merge adjacent removed+added → 'changed' ---
  // When a block's text is edited, diffArrays emits removed(old) then added(new).
  // Merging gives word-level InlineDiff instead of separate red/green blocks.
  const merged: BlockDiff[] = []
  let i = 0

  while (i < rawDiffs.length) {
    const current = rawDiffs[i]!
    const next = rawDiffs[i + 1]

    if (current.type === 'removed' && next?.type === 'added') {
      merged.push({
        blockNumber: current.blockNumber,
        type: 'changed',
        oldText: current.oldText,
        newText: next.newText,
      })
      i += 2
    } else {
      merged.push(current)
      i++
    }
  }

  // --- Pass 3: context injection ---
  // For each change, include 1 unchanged block before + 1 after for orientation.
  // Between non-adjacent change groups, emit a separator (like git's @@ hunk headers).
  const isChange = (d: BlockDiff) => d.type !== 'context'

  // Build a Set of indices that should be included as context
  const contextIndices = new Set<number>()
  for (let idx = 0; idx < merged.length; idx++) {
    if (isChange(merged[idx]!)) {
      // Include 1 unchanged before (scan backwards for nearest context)
      for (let b = idx - 1; b >= 0; b--) {
        if (merged[b]!.type === 'context') {
          contextIndices.add(b)
          break
        }
      }
      // Include 1 unchanged after (scan forwards for nearest context)
      for (let a = idx + 1; a < merged.length; a++) {
        if (merged[a]!.type === 'context') {
          contextIndices.add(a)
          break
        }
      }
    }
  }

  // Assemble final list: changes + selected context + separators.
  // When consecutive emitted entries aren't adjacent in the merged array,
  // there are skipped unchanged blocks between them — emit a separator.
  const result: BlockDiff[] = []
  let lastEmittedIdx = -1

  for (let idx = 0; idx < merged.length; idx++) {
    const entry = merged[idx]!
    const shouldEmit = isChange(entry) || contextIndices.has(idx)

    if (!shouldEmit) continue

    // Gap between consecutive emitted entries → separator
    if (lastEmittedIdx >= 0 && idx - lastEmittedIdx > 1) {
      result.push({blockNumber: 0, type: 'separator'})
    }

    result.push(entry)
    lastEmittedIdx = idx
  }

  return result
}

// --- Styles ---

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

// --- Sub-components ---

const CONTEXT_TRUNCATE_LENGTH = 100

function BlockDiffRow({blockDiff}: {blockDiff: BlockDiff}) {
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
      {/* Block number prefix */}
      <Box style={{flexShrink: 0, width: 32, textAlign: 'right'}}>
        <Text size={0} muted>
          ¶ {blockDiff.blockNumber}
        </Text>
      </Box>

      {/* Block content */}
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

// --- Main component ---

export function PortableTextDiff({
  oldBlocks,
  newBlocks,
  maxBlocks = DEFAULT_MAX_BLOCKS,
}: PortableTextDiffProps) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const [showAll, setShowAll] = useState(false)
  const toggleShowAll = useCallback(() => setShowAll((prev) => !prev), [])

  const blockDiffs = useMemo(() => computeBlockDiffs(oldBlocks, newBlocks), [oldBlocks, newBlocks])

  // Count only actual changes for truncation — context and separators don't count
  const changeCount = useMemo(
    () => blockDiffs.filter((d) => d.type !== 'context' && d.type !== 'separator').length,
    [blockDiffs],
  )

  // Always call useMemo — hooks must not be called conditionally
  const visibleDiffs = useMemo(() => {
    if (showAll) return blockDiffs

    let changesIncluded = 0
    const result: BlockDiff[] = []

    for (const diff of blockDiffs) {
      if (diff.type === 'context' || diff.type === 'separator') {
        // Include context/separator only if we haven't hit the limit yet
        if (changesIncluded < maxBlocks) {
          result.push(diff)
        }
      } else {
        changesIncluded++
        if (changesIncluded <= maxBlocks) {
          result.push(diff)
        }
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
