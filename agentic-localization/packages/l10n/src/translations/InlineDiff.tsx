/**
 * Word-level inline diff component for string fields.
 *
 * Uses `jsdiff`'s `diffWords` for word-level diffs — the right granularity
 * for natural language content. Character-level diffs (fast-diff) produced
 * noisy, unusable output for prose.
 *
 * Renders deletions as red strikethrough, additions as green highlight,
 * with 20% opacity backgrounds per @ux spec.
 *
 * Also exports SimpleValueDiff and ArrayDiffSummary for non-text field types.
 */

import {Box, Card, Flex, Text} from '@sanity/ui'
import type {Change} from 'diff'
import {diffWords} from 'diff'
import {useCallback, useMemo, useState} from 'react'

// --- Constants ---

const DEFAULT_MAX_LENGTH = 500

// CSS custom properties for theme-aware colors (dark mode compatible)
const DELETION_STYLE: React.CSSProperties = {
  backgroundColor: 'color-mix(in srgb, var(--card-badge-critical-bg-color) 50%, transparent)',
  textDecoration: 'line-through',
  borderRadius: 2,
  padding: '0 1px',
}

const ADDITION_STYLE: React.CSSProperties = {
  backgroundColor: 'color-mix(in srgb, var(--card-badge-positive-bg-color) 50%, transparent)',
  borderRadius: 2,
  padding: '0 1px',
}

// --- Types ---

interface InlineDiffProps {
  oldValue: string
  newValue: string
  /** Max total characters before truncation (default: 500) */
  maxLength?: number
}

// --- Helpers ---

/** Count words in diff segments of a given type */
function countWords(changes: Change[], type: 'added' | 'removed'): number {
  return changes
    .filter((c) => c[type])
    .reduce((count, c) => count + c.value.trim().split(/\s+/).filter(Boolean).length, 0)
}

/** Compute total character length of all diff segments */
function totalLength(changes: Change[]): number {
  return changes.reduce((sum, c) => sum + c.value.length, 0)
}

// --- Main component ---

export function InlineDiff({oldValue, newValue, maxLength = DEFAULT_MAX_LENGTH}: InlineDiffProps) {
  const [showFull, setShowFull] = useState(false)
  const toggleFull = useCallback(() => setShowFull((prev) => !prev), [])

  // Memoize the diff computation — don't recompute on every render
  const changes = useMemo(() => diffWords(oldValue, newValue), [oldValue, newValue])

  const wordsRemoved = useMemo(() => countWords(changes, 'removed'), [changes])
  const wordsAdded = useMemo(() => countWords(changes, 'added'), [changes])

  const isTruncated = !showFull && totalLength(changes) > maxLength

  // Build truncated diff segments if needed
  const visibleChanges = useMemo(() => {
    if (!isTruncated) return changes

    const result: Change[] = []
    let charCount = 0

    for (const change of changes) {
      if (charCount >= maxLength) break

      const remaining = maxLength - charCount
      if (change.value.length <= remaining) {
        result.push(change)
        charCount += change.value.length
      } else {
        result.push({...change, value: change.value.slice(0, remaining)})
        charCount = maxLength
      }
    }

    return result
  }, [changes, isTruncated, maxLength])

  return (
    <Card padding={3} radius={2} tone="transparent" border>
      {/* Visually-hidden screen reader summary */}
      <Box
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
        }}
      >
        <Text>
          {wordsRemoved} word{wordsRemoved !== 1 ? 's' : ''} removed, {wordsAdded} word
          {wordsAdded !== 1 ? 's' : ''} added
        </Text>
      </Box>

      {/* Inline diff content */}
      <Text size={1} style={{lineHeight: 1.6, wordBreak: 'break-word'}}>
        {visibleChanges.map((change, i) => {
          if (change.removed) {
            return (
              <span key={i} style={DELETION_STYLE} aria-label={`removed: ${change.value}`}>
                {change.value}
              </span>
            )
          }
          if (change.added) {
            return (
              <span key={i} style={ADDITION_STYLE} aria-label={`added: ${change.value}`}>
                {change.value}
              </span>
            )
          }
          return <span key={i}>{change.value}</span>
        })}
        {isTruncated && (
          <span
            role="button"
            tabIndex={0}
            onClick={toggleFull}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') toggleFull()
            }}
            style={{
              color: 'var(--card-link-color)',
              cursor: 'pointer',
              marginLeft: 4,
            }}
          >
            … [show full diff]
          </span>
        )}
      </Text>
    </Card>
  )
}

// --- Simple value diff for non-text types ---

interface SimpleValueDiffProps {
  oldValue: unknown
  newValue: unknown
}

function formatSimpleValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (typeof value === 'object' && '_ref' in (value as Record<string, unknown>)) {
    return (value as Record<string, unknown>)._ref as string
  }
  return JSON.stringify(value)
}

export function SimpleValueDiff({oldValue, newValue}: SimpleValueDiffProps) {
  const oldStr = formatSimpleValue(oldValue)
  const newStr = formatSimpleValue(newValue)

  return (
    <Card padding={3} radius={2} tone="transparent" border>
      <Flex align="center" gap={2} wrap="wrap">
        <Text size={1} style={DELETION_STYLE}>
          {oldStr}
        </Text>
        <Text size={1} muted>
          →
        </Text>
        <Text size={1} style={ADDITION_STYLE}>
          {newStr}
        </Text>
      </Flex>
    </Card>
  )
}

// --- Array diff summary ---

interface ArrayDiffSummaryProps {
  oldValue: unknown
  newValue: unknown
}

export function ArrayDiffSummary({oldValue, newValue}: ArrayDiffSummaryProps) {
  const oldArr = Array.isArray(oldValue) ? oldValue : []
  const newArr = Array.isArray(newValue) ? newValue : []
  const oldLen = oldArr.length
  const newLen = newArr.length
  const delta = newLen - oldLen

  let description: string
  if (oldLen === 0 && newLen > 0) {
    description = `${newLen} item${newLen !== 1 ? 's' : ''} added`
  } else if (newLen === 0 && oldLen > 0) {
    description = `${oldLen} item${oldLen !== 1 ? 's' : ''} removed`
  } else if (delta > 0) {
    description = `${oldLen} item${oldLen !== 1 ? 's' : ''} → ${newLen} item${newLen !== 1 ? 's' : ''} (+${delta} added)`
  } else if (delta < 0) {
    description = `${oldLen} item${oldLen !== 1 ? 's' : ''} → ${newLen} item${newLen !== 1 ? 's' : ''} (${delta} removed)`
  } else {
    description = `${oldLen} item${oldLen !== 1 ? 's' : ''} → ${newLen} item${newLen !== 1 ? 's' : ''} (reordered or modified)`
  }

  return (
    <Card padding={3} radius={2} tone="transparent" border>
      <Text size={1} muted>
        {description}
      </Text>
    </Card>
  )
}
