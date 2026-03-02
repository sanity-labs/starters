/**
 * Build a human-readable field summary for the AI analysis prompt.
 *
 * Tiered by field type to balance AI comprehension with token budget:
 * - String fields: before→after values (200 char cap each)
 * - PT fields: diff-aware change regions with context (2000 char budget)
 * - Other fields: magnitude label only
 *
 * Shared by the Sanity Function (T2) and client-side fallback (T3).
 * The caller is responsible for populating `textExtracts` — the function
 * uses `pt::text()` GROQ projection for current docs and `extractBlockText()`
 * for historical docs; the client uses `extractBlockText()` for both.
 */

import type {FieldChange} from './computeFieldChanges'

/** Diff function signature — injected by caller to avoid bundler issues with transitive deps. */
export type DiffWordsFn = (
  oldStr: string,
  newStr: string,
) => Array<{value: string; added?: boolean; removed?: boolean}>

/** Pre-extracted plain text for PT fields. */
export interface TextExtracts {
  [fieldName: string]: {oldText?: string; newText?: string}
}

/** Per-field string value cap (title, excerpt, slug, etc.) */
const STRING_VALUE_CAP = 200

/** Per-field PT diff region budget */
const PT_REGION_BUDGET = 2000

/** Context chars before/after each change region */
const CONTEXT_CHARS = 100

/** Total field summary budget — truncate if exceeded */
const FIELD_SUMMARY_BUDGET = 4000

/** Max change regions to show per field */
const MAX_REGIONS = 4

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max) + '…[truncated]'
}

// --- Diff-aware extraction ---

/** A change region with surrounding context. */
interface ChangeRegion {
  /** Unchanged text before the change */
  contextBefore: string
  /** Text removed from old version */
  removed: string
  /** Text added in new version */
  added: string
  /** Unchanged text after the change */
  contextAfter: string
  /** Size of the change (removed + added chars) for prioritization */
  size: number
}

/**
 * A segment from the diff output — either unchanged text or a change group.
 * Pre-processing diffWords output into this structure makes region building
 * straightforward without complex index management.
 */
type DiffSegment =
  | {type: 'unchanged'; text: string}
  | {type: 'change'; removed: string; added: string}

/**
 * Collapse raw diffWords output into alternating unchanged/change segments.
 * Contiguous removed+added entries become a single change segment.
 */
function collapseDiffSegments(
  rawChanges: Array<{value: string; added?: boolean; removed?: boolean}>,
): DiffSegment[] {
  const segments: DiffSegment[] = []
  let i = 0

  while (i < rawChanges.length) {
    const entry = rawChanges[i]!

    if (!entry.added && !entry.removed) {
      segments.push({type: 'unchanged', text: entry.value})
      i++
      continue
    }

    // Collect contiguous removed+added into one change segment
    let removed = ''
    let added = ''
    while (i < rawChanges.length) {
      const c = rawChanges[i]!
      if (c.removed) {
        removed += c.value
        i++
      } else if (c.added) {
        added += c.value
        i++
      } else {
        break
      }
    }
    segments.push({type: 'change', removed, added})
  }

  return segments
}

/**
 * Build diff-aware text extraction for PT fields.
 *
 * Instead of showing two full text blobs (which truncate identically when
 * edits are in the tail), finds the actual change regions using jsdiff and
 * extracts context windows around each one.
 */
export function buildDiffAwareExtract(
  oldText: string,
  newText: string,
  diffWordsFn: DiffWordsFn,
  contextChars: number = CONTEXT_CHARS,
  totalBudget: number = PT_REGION_BUDGET,
): string {
  // Edge case: empty extracts
  if (!oldText && !newText) {
    return '  (text extraction unavailable)'
  }

  const rawChanges = diffWordsFn(oldText, newText)
  const segments = collapseDiffSegments(rawChanges)

  // Build regions: for each change segment, grab context from adjacent unchanged segments
  const regions: ChangeRegion[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    if (seg.type !== 'change') continue

    // Context before: tail of the preceding unchanged segment
    const prevSeg = i > 0 ? segments[i - 1] : undefined
    const gapBefore = prevSeg?.type === 'unchanged' ? prevSeg.text : ''
    const contextBefore =
      gapBefore.length <= contextChars ? gapBefore.trim() : gapBefore.slice(-contextChars).trim()

    // Context after: head of the following unchanged segment
    const nextSeg = i + 1 < segments.length ? segments[i + 1] : undefined
    const gapAfter = nextSeg?.type === 'unchanged' ? nextSeg.text : ''
    const contextAfter =
      gapAfter.length <= contextChars ? gapAfter.trim() : gapAfter.slice(0, contextChars).trim()

    // Merge with previous region if the gap between them is small
    if (regions.length > 0 && gapBefore.length < contextChars * 2) {
      const prev = regions[regions.length - 1]!
      prev.removed += gapBefore + seg.removed
      prev.added += gapBefore + seg.added
      prev.contextAfter = contextAfter
      prev.size += seg.removed.length + seg.added.length
      continue
    }

    regions.push({
      contextBefore,
      removed: seg.removed,
      added: seg.added,
      contextAfter,
      size: seg.removed.length + seg.added.length,
    })
  }

  // Edge case: diffWords found no changes (structural diff only)
  if (regions.length === 0) {
    return '  (no text-level differences detected — change may be in block structure or formatting)'
  }

  // Prioritize largest changes if we have too many regions
  let displayRegions = regions
  let hiddenCount = 0
  if (regions.length > MAX_REGIONS) {
    const sorted = [...regions].sort((a, b) => b.size - a.size)
    displayRegions = sorted.slice(0, MAX_REGIONS)
    hiddenCount = regions.length - MAX_REGIONS
    // Restore original order
    displayRegions.sort((a, b) => regions.indexOf(a) - regions.indexOf(b))
  }

  // Format each region
  const lines: string[] = []
  let totalChars = 0

  for (let idx = 0; idx < displayRegions.length; idx++) {
    const region = displayRegions[idx]!
    const regionLines: string[] = []

    regionLines.push(`  Change ${idx + 1}:`)

    if (region.contextBefore) {
      regionLines.push(`    Context: "...${escapeQuotes(region.contextBefore)}"`)
    }

    if (region.removed) {
      const removedText = truncateRegion(region.removed, totalBudget / 2)
      regionLines.push(`    Removed: "${escapeQuotes(removedText)}"`)
    } else {
      regionLines.push(`    Removed: (nothing)`)
    }

    if (region.added) {
      const addedText = truncateRegion(region.added, totalBudget / 2)
      regionLines.push(`    Added: "${escapeQuotes(addedText)}"`)
    } else {
      regionLines.push(`    Added: (nothing)`)
    }

    if (region.contextAfter) {
      regionLines.push(`    Context: "${escapeQuotes(region.contextAfter)}..."`)
    }

    const regionText = regionLines.join('\n')
    totalChars += regionText.length

    if (totalChars > totalBudget) {
      const remaining = displayRegions.length - idx
      if (remaining > 0) {
        lines.push(`  (+${remaining + hiddenCount} additional changes not shown)`)
      }
      break
    }

    lines.push(regionText)
  }

  if (hiddenCount > 0 && totalChars <= totalBudget) {
    lines.push(`  (+${hiddenCount} additional minor changes not shown)`)
  }

  return lines.join('\n')
}

/** Truncate a region's text if it exceeds the budget (full rewrites). */
function truncateRegion(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const half = Math.floor(maxChars / 2) - 15
  return text.slice(0, half) + '…[truncated]…' + text.slice(-half)
}

/** Escape double quotes in text for clean formatting. */
function escapeQuotes(text: string): string {
  return text.replace(/"/g, '\\"')
}

// --- Main export ---

/**
 * Build the field summary string for the AI analysis prompt.
 *
 * Only includes changed fields — the AI doesn't need to see unchanged ones.
 */
export function buildFieldSummary(
  changes: FieldChange[],
  textExtracts: TextExtracts = {},
  diffWordsFn?: DiffWordsFn,
): string {
  const lines: string[] = []

  for (const c of changes) {
    if (!c.changed) continue

    if (c.fieldType === 'string') {
      const header = `- ${c.fieldName} (${c.fieldType}): ${c.magnitude} change`
      const oldStr = truncate(String(c.oldValue ?? ''), STRING_VALUE_CAP)
      const newStr = truncate(String(c.newValue ?? ''), STRING_VALUE_CAP)
      lines.push(`${header}\n  Old: "${oldStr}"\n  New: "${newStr}"`)
    } else if (c.fieldType === 'portableText') {
      const extract = textExtracts[c.fieldName]
      const oldText = extract?.oldText ?? ''
      const newText = extract?.newText ?? ''
      // diff-aware extraction with char counts in header
      const ptHeader = `- ${c.fieldName} (${c.fieldType}): ${c.magnitude} change (old: ${oldText.length} chars, new: ${newText.length} chars)`
      const diffExtract = diffWordsFn
        ? buildDiffAwareExtract(oldText, newText, diffWordsFn)
        : '  (diff function not provided — PT diff unavailable)'
      lines.push(`${ptHeader}\n${diffExtract}`)
    } else {
      const header = `- ${c.fieldName} (${c.fieldType}): ${c.magnitude} change`
      lines.push(header)
    }
  }

  let result = lines.join('\n')
  if (result.length > FIELD_SUMMARY_BUDGET) {
    result = result.slice(0, FIELD_SUMMARY_BUDGET) + '\n…[truncated]'
  }
  return result
}
