/**
 * Shared by the Sanity Function (T2) and client-side fallback (T3).
 * The caller is responsible for populating `textExtracts` — the function
 * uses `pt::text()` GROQ projection for current docs and `extractBlockText()`
 * for historical docs; the client uses `extractBlockText()` for both.
 *
 * The PT regions come from `core/textDiff`, the same segments the reviewer's
 * rendered diff reads, so the prompt and the UI can never disagree about what
 * changed.
 */

import type {FieldChange} from './computeFieldChanges'
import type {TextSegment} from './textDiff'

import {diffTextSegments} from './textDiff'

/** Pre-extracted plain text for PT fields. */
export interface TextExtracts {
  [fieldName: string]: {oldText?: string; newText?: string}
}

const STRING_VALUE_CAP = 200

const PT_REGION_BUDGET = 2000

const CONTEXT_CHARS = 100

const FIELD_SUMMARY_BUDGET = 4000

const MAX_REGIONS = 4

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max) + '…[truncated]'
}

interface ChangeRegion {
  contextBefore: string
  removed: string
  added: string
  contextAfter: string
  /** Size of the change (removed + added chars) for prioritization */
  size: number
}

/**
 * Collapsing the removed/added pair into one entry makes region building
 * straightforward without complex index management.
 */
type DiffSegment =
  | {type: 'unchanged'; text: string}
  | {type: 'change'; removed: string; added: string}

function collapseDiffSegments(segments: readonly TextSegment[]): DiffSegment[] {
  const collapsed: DiffSegment[] = []
  let i = 0

  while (i < segments.length) {
    const segment = segments[i]

    if (segment.action === 'unchanged') {
      collapsed.push({type: 'unchanged', text: segment.text})
      i++
      continue
    }

    let removed = ''
    let added = ''
    while (i < segments.length && segments[i].action !== 'unchanged') {
      const change = segments[i]
      if (change.action === 'removed') removed += change.text
      else added += change.text
      i++
    }
    collapsed.push({type: 'change', removed, added})
  }

  return collapsed
}

/**
 * Instead of showing two full text blobs (which truncate identically when
 * edits are in the tail), finds the actual change regions and extracts context
 * windows around each one.
 */
export function buildDiffAwareExtract(
  oldText: string,
  newText: string,
  contextChars: number = CONTEXT_CHARS,
  totalBudget: number = PT_REGION_BUDGET,
): string {
  if (!oldText && !newText) {
    return '  (text extraction unavailable)'
  }

  const segments = collapseDiffSegments(diffTextSegments(oldText, newText))

  const regions: ChangeRegion[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (seg.type !== 'change') continue

    const prevSeg = i > 0 ? segments[i - 1] : undefined
    const gapBefore = prevSeg?.type === 'unchanged' ? prevSeg.text : ''
    const contextBefore =
      gapBefore.length <= contextChars ? gapBefore.trim() : gapBefore.slice(-contextChars).trim()

    const nextSeg = i + 1 < segments.length ? segments[i + 1] : undefined
    const gapAfter = nextSeg?.type === 'unchanged' ? nextSeg.text : ''
    const contextAfter =
      gapAfter.length <= contextChars ? gapAfter.trim() : gapAfter.slice(0, contextChars).trim()

    if (regions.length > 0 && gapBefore.length < contextChars * 2) {
      const prev = regions[regions.length - 1]
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

  if (regions.length === 0) {
    return '  (no text-level differences detected — change may be in block structure or formatting)'
  }

  let displayRegions = regions
  let hiddenCount = 0
  if (regions.length > MAX_REGIONS) {
    const sorted = [...regions].sort((a, b) => b.size - a.size)
    displayRegions = sorted.slice(0, MAX_REGIONS)
    hiddenCount = regions.length - MAX_REGIONS
    displayRegions.sort((a, b) => regions.indexOf(a) - regions.indexOf(b))
  }

  const lines: string[] = []
  let totalChars = 0

  for (let idx = 0; idx < displayRegions.length; idx++) {
    const region = displayRegions[idx]
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

function truncateRegion(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const half = Math.floor(maxChars / 2) - 15
  return text.slice(0, half) + '…[truncated]…' + text.slice(-half)
}

function escapeQuotes(text: string): string {
  return text.replace(/"/g, '\\"')
}

/**
 * Only includes changed fields — the AI doesn't need to see unchanged ones.
 */
export function buildFieldSummary(changes: FieldChange[], textExtracts: TextExtracts = {}): string {
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
      const ptHeader = `- ${c.fieldName} (${c.fieldType}): ${c.magnitude} change (old: ${oldText.length} chars, new: ${newText.length} chars)`
      lines.push(`${ptHeader}\n${buildDiffAwareExtract(oldText, newText)}`)
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
