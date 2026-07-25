/**
 * Word-level inline diff component for string fields.
 *
 * The segments come from `@starter/l10n`'s `diffTextSegments` — `@sanity/diff`
 * word-aligned — so this component and the AI analysis prompt read the same
 * diff. Rendering only: deletions as red strikethrough, additions as green
 * highlight, with 20% opacity backgrounds per @ux spec.
 *
 * Also exports SimpleValueDiff and ArrayDiffSummary for non-text field types.
 */

import {Card, Flex, SrOnly, Text} from '@sanity/ui'
import {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'sanity'

import type {TextSegment} from '@starter/l10n'

import {diffTextSegments} from '@starter/l10n'
import {l10nLocaleNamespace} from '../i18n'

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

/** Count words in diff segments of a given action */
function countWords(segments: TextSegment[], action: 'added' | 'removed'): number {
  return segments
    .filter((segment) => segment.action === action)
    .reduce((count, segment) => count + segment.text.trim().split(/\s+/).filter(Boolean).length, 0)
}

/** Compute total character length of all diff segments */
function totalLength(segments: TextSegment[]): number {
  return segments.reduce((sum, segment) => sum + segment.text.length, 0)
}

// --- Main component ---

export function InlineDiff({oldValue, newValue, maxLength = DEFAULT_MAX_LENGTH}: InlineDiffProps) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const [showFull, setShowFull] = useState(false)
  const toggleFull = useCallback(() => setShowFull((prev) => !prev), [])

  // Memoize the diff computation — don't recompute on every render
  const segments = useMemo(() => diffTextSegments(oldValue, newValue), [oldValue, newValue])

  const wordsRemoved = useMemo(() => countWords(segments, 'removed'), [segments])
  const wordsAdded = useMemo(() => countWords(segments, 'added'), [segments])

  const isTruncated = !showFull && totalLength(segments) > maxLength

  // Build truncated diff segments if needed
  const visibleSegments = useMemo(() => {
    if (!isTruncated) return segments

    const result: TextSegment[] = []
    let charCount = 0

    for (const segment of segments) {
      if (charCount >= maxLength) break

      const remaining = maxLength - charCount
      if (segment.text.length <= remaining) {
        result.push(segment)
        charCount += segment.text.length
      } else {
        result.push({...segment, text: segment.text.slice(0, remaining)})
        charCount = maxLength
      }
    }

    return result
  }, [segments, isTruncated, maxLength])

  return (
    <Card padding={3} radius={2} tone="transparent" border>
      <SrOnly>
        <Text>{t('diff.sr-summary', {removed: wordsRemoved, added: wordsAdded})}</Text>
      </SrOnly>

      {/* Inline diff content */}
      <Text size={1} style={{lineHeight: 1.6, wordBreak: 'break-word'}}>
        {visibleSegments.map((segment, i) => {
          if (segment.action === 'removed') {
            return (
              <span key={i} style={DELETION_STYLE} aria-label={`removed: ${segment.text}`}>
                {segment.text}
              </span>
            )
          }
          if (segment.action === 'added') {
            return (
              <span key={i} style={ADDITION_STYLE} aria-label={`added: ${segment.text}`}>
                {segment.text}
              </span>
            )
          }
          return <span key={i}>{segment.text}</span>
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
            {t('diff.show-full')}
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
