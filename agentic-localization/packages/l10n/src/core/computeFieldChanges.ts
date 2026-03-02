/**
 * Pure functions for computing field-level changes between document snapshots.
 *
 * Zero React/Sanity dependencies — safe to import in Sanity Functions runtime.
 *
 * Extracted from useStaleChangeSummary.ts so the analyze-stale-translations
 * function can use these without pulling in React.
 */

// --- Types ---

export type FieldChangeMagnitude =
  | 'unchanged'
  | 'minor'
  | 'updated'
  | 'rewritten'
  | 'added'
  | 'removed'

export type FieldType =
  | 'string'
  | 'portableText'
  | 'array'
  | 'number'
  | 'boolean'
  | 'image'
  | 'reference'
  | 'other'

export interface FieldChange {
  /** Field path (e.g., 'title', 'body', 'excerpt') */
  fieldName: string
  /** Whether this field changed */
  changed: boolean
  /** Magnitude of the change */
  magnitude: FieldChangeMagnitude
  /** Detected field type for Tier 3 inline diff routing */
  fieldType: FieldType
  /** Value from the historical (pre-stale) document snapshot */
  oldValue?: unknown
  /** Value from the current source document */
  newValue?: unknown
}

// --- Constants ---

/** System fields to exclude from diff comparison */
const SYSTEM_FIELDS = new Set([
  '_id',
  '_rev',
  '_type',
  '_createdAt',
  '_updatedAt',
  '_originalId',
  'language',
])

/** Magnitude thresholds based on character delta percentage */
const MINOR_THRESHOLD = 0.2
const REWRITTEN_THRESHOLD = 0.7

// --- Pure functions ---

/**
 * Detect the field type from a value using heuristics.
 * Uses the "most informative" value — prefers non-null.
 * If both old and new exist, uses new (it's the latest schema shape).
 */
export function detectFieldType(oldValue: unknown, newValue: unknown): FieldType {
  // Use the most informative value (prefer non-null, prefer new)
  const value = newValue ?? oldValue
  if (value === null || value === undefined) return 'other'

  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'

  if (Array.isArray(value)) {
    // Check if this is Portable Text: array of objects with _type: 'block' and children
    const isPortableText =
      value.length > 0 &&
      value.some(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          '_type' in item &&
          (item as Record<string, unknown>)._type === 'block' &&
          'children' in item,
      )
    return isPortableText ? 'portableText' : 'array'
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    // Image: has _type: 'image' and asset
    if (obj._type === 'image' && 'asset' in obj) return 'image'
    // Reference: has _ref
    if ('_ref' in obj) return 'reference'
  }

  return 'other'
}

/**
 * Stringify a field value for character-length comparison.
 * For Portable Text / arrays, JSON.stringify gives us a reasonable
 * character count without deep-diffing individual blocks.
 */
function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

/**
 * Compute the magnitude of change between two field values.
 */
export function computeMagnitude(oldValue: unknown, newValue: unknown): FieldChangeMagnitude {
  const oldExists = oldValue !== null && oldValue !== undefined
  const newExists = newValue !== null && newValue !== undefined

  if (!oldExists && !newExists) return 'unchanged'
  if (!oldExists && newExists) return 'added'
  if (oldExists && !newExists) return 'removed'

  const oldStr = stringifyValue(oldValue)
  const newStr = stringifyValue(newValue)

  if (oldStr === newStr) return 'unchanged'

  // Compute character delta percentage relative to the longer string
  const maxLen = Math.max(oldStr.length, newStr.length)
  if (maxLen === 0) return 'unchanged'

  // Levenshtein is expensive — use length delta + content check as proxy.
  // For short strings, any change is at least 'minor'.
  // For longer strings, use character count difference as magnitude proxy.
  const lenDelta = Math.abs(oldStr.length - newStr.length)
  const deltaRatio = lenDelta / maxLen

  // If lengths are similar but content differs, estimate based on
  // how many characters are different (simple char-by-char scan)
  if (deltaRatio < MINOR_THRESHOLD) {
    // Lengths are similar — check content difference
    let diffChars = 0
    const minLen = Math.min(oldStr.length, newStr.length)
    for (let i = 0; i < minLen; i++) {
      if (oldStr[i] !== newStr[i]) diffChars++
    }
    diffChars += Math.abs(oldStr.length - newStr.length)
    const contentDelta = diffChars / maxLen

    if (contentDelta < MINOR_THRESHOLD) return 'minor'
    if (contentDelta < REWRITTEN_THRESHOLD) return 'updated'
    return 'rewritten'
  }

  if (deltaRatio < REWRITTEN_THRESHOLD) return 'updated'
  return 'rewritten'
}

/**
 * Extract user-defined field names from a document, excluding system fields.
 */
function getUserFields(doc: Record<string, unknown>): string[] {
  return Object.keys(doc).filter((key) => !SYSTEM_FIELDS.has(key) && !key.startsWith('_'))
}

/**
 * Compute field-level changes between two document snapshots.
 */
export function computeFieldChanges(
  historicalDoc: Record<string, unknown>,
  currentDoc: Record<string, unknown>,
): FieldChange[] {
  // Union of all user fields from both documents
  const allFields = new Set([...getUserFields(historicalDoc), ...getUserFields(currentDoc)])

  const changes: FieldChange[] = []

  for (const fieldName of allFields) {
    const oldValue = historicalDoc[fieldName]
    const newValue = currentDoc[fieldName]
    const magnitude = computeMagnitude(oldValue, newValue)
    changes.push({
      fieldName,
      changed: magnitude !== 'unchanged',
      magnitude,
      fieldType: detectFieldType(oldValue, newValue),
      oldValue,
      newValue,
    })
  }

  // Sort: changed fields first (by severity), then unchanged
  const magnitudeOrder: Record<FieldChangeMagnitude, number> = {
    rewritten: 0,
    removed: 1,
    added: 2,
    updated: 3,
    minor: 4,
    unchanged: 5,
  }

  changes.sort((a, b) => magnitudeOrder[a.magnitude] - magnitudeOrder[b.magnitude])

  return changes
}
