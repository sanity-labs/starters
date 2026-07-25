/**
 * The locale × field grid the reviewer picks a compare scope from.
 *
 * Rows are every target locale, always — a locale that never came back is the
 * failure that ships, so filtering to "what changed" would hide it and make the
 * grid's height a function of the run. Columns are bounded: the field tier's are
 * the schema's internationalized fields, the document tier's are the union of
 * fields that actually changed across the siblings.
 *
 * Cells speak the engine's vocabulary — `LocaleRunStage` for a row that failed,
 * `FieldChangeMagnitude` for everything else — so the grid, the detail badge and
 * the analysis prompt cannot disagree about what "rewritten" means.
 */

import type {FieldChange, FieldChangeMagnitude, LocaleRunStage} from '@starter/l10n'

export type CellState = 'same' | 'minor' | 'updated' | 'rewritten' | 'missing' | 'failed'

/** Read-only cell vocabulary. One glyph, no verb. */
export const CELL_GLYPH: Record<CellState, string> = {
  same: '·',
  minor: '~',
  updated: '▰',
  rewritten: '▰▰',
  missing: '○',
  failed: '⚠',
}

export type RowState = 'ok' | 'missing' | 'failed'

/** One locale's side of the run, as the grid reads it. */
export interface LocaleSnapshot {
  locale: string
  /** Stage of the locale's child run; `null` when the run does not cover it. */
  stage: LocaleRunStage | null
  /** Nowhere holds this locale's translation — the document tier's whole-row miss. */
  absent: boolean
  targetDocumentId: string | null
  changes: readonly FieldChange[]
  /**
   * Field paths this locale actually carries a value for. The field tier can be
   * genuinely half-covered; the document tier passes `null` because a sibling
   * either exists or the row is `absent`.
   */
  present: ReadonlySet<string> | null
}

export interface GridCell {
  field: string
  state: CellState
  magnitude: FieldChangeMagnitude | null
  /** Signed character delta, for the deferred-diff badge. */
  charDelta: number
}

export interface GridRow {
  locale: string
  stage: LocaleRunStage | null
  state: RowState
  targetDocumentId: string | null
  cells: readonly GridCell[]
  /** Cells a reviewer has to look at. */
  changed: number
}

export interface GridModel {
  columns: readonly string[]
  rows: readonly GridRow[]
}

/** Most severe first — the order both the columns and the detail pane read. */
const IMPACT: Record<FieldChangeMagnitude, number> = {
  rewritten: 0,
  removed: 1,
  added: 2,
  updated: 3,
  minor: 4,
  unchanged: 5,
}

const CELL_STATE: Record<FieldChangeMagnitude, CellState> = {
  rewritten: 'rewritten',
  removed: 'rewritten',
  added: 'updated',
  updated: 'updated',
  minor: 'minor',
  unchanged: 'same',
}

/** Every character of every string under a value, ignoring Sanity's namespace. */
function textLength(value: unknown): number {
  if (typeof value === 'string') return value.length
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).length
  if (Array.isArray(value))
    return value.reduce<number>((total, item) => total + textLength(item), 0)
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce<number>(
      (total, [key, entry]) => (key.startsWith('_') ? total : total + textLength(entry)),
      0,
    )
  }
  return 0
}

/** How many characters the change adds, negative when it removes. */
export function charDelta(change: FieldChange): number {
  return textLength(change.newValue) - textLength(change.oldValue)
}

/** Characters on both sides — the weight the detail pane defers on. */
export function changeWeight(change: FieldChange): number {
  return textLength(change.oldValue) + textLength(change.newValue)
}

/**
 * Anything heavier than a paragraph, and every Portable Text field, renders as a
 * badge and a count until the reviewer asks for it. GitHub's lockfile rule: the
 * pane stays scannable at 296px because the big diffs are opt-in.
 */
const AUTO_EXPAND_CHARS = 320

export function defersDiff(change: FieldChange): boolean {
  return change.fieldType === 'portableText' || changeWeight(change) > AUTO_EXPAND_CHARS
}

/** A locale's changed fields, most consequential first. */
export function orderByImpact(changes: readonly FieldChange[]): FieldChange[] {
  return [...changes].sort(
    (a, b) =>
      IMPACT[a.magnitude] - IMPACT[b.magnitude] ||
      Math.abs(charDelta(b)) - Math.abs(charDelta(a)) ||
      a.fieldName.localeCompare(b.fieldName),
  )
}

/**
 * The union of fields that changed in any locale, in the same impact order.
 * Bounded by the run rather than by the schema: a document type with forty
 * fields still yields the two or five a translation pass actually moved.
 */
export function unionColumns(locales: readonly LocaleSnapshot[]): string[] {
  const best = new Map<string, {impact: number; weight: number}>()

  for (const snapshot of locales) {
    for (const change of snapshot.changes) {
      if (!change.changed) continue
      const held = best.get(change.fieldName)
      const impact = IMPACT[change.magnitude]
      const weight = Math.abs(charDelta(change))
      if (!held || impact < held.impact || (impact === held.impact && weight > held.weight)) {
        best.set(change.fieldName, {impact, weight})
      }
    }
  }

  return [...best.entries()]
    .sort(
      ([nameA, a], [nameB, b]) =>
        a.impact - b.impact || b.weight - a.weight || nameA.localeCompare(nameB),
    )
    .map(([name]) => name)
}

export interface BuildGridArgs {
  locales: readonly LocaleSnapshot[]
  /** The field tier's fixed schema columns. Omit to take the changed-field union. */
  columns?: readonly string[]
}

export function buildGrid({locales, columns}: BuildGridArgs): GridModel {
  const resolved = columns ?? unionColumns(locales)

  const rows = locales.map((snapshot): GridRow => {
    const state: RowState =
      snapshot.stage === 'failed' ? 'failed' : snapshot.absent ? 'missing' : 'ok'
    const changeByField = new Map(snapshot.changes.map((change) => [change.fieldName, change]))

    const cells = resolved.map((field): GridCell => {
      if (state !== 'ok') {
        return {
          field,
          state: state === 'failed' ? 'failed' : 'missing',
          magnitude: null,
          charDelta: 0,
        }
      }
      if (snapshot.present && !snapshot.present.has(field)) {
        return {field, state: 'missing', magnitude: null, charDelta: 0}
      }
      const change = changeByField.get(field)
      if (!change || !change.changed) {
        return {field, state: 'same', magnitude: change?.magnitude ?? 'unchanged', charDelta: 0}
      }
      return {
        field,
        state: CELL_STATE[change.magnitude],
        magnitude: change.magnitude,
        charDelta: charDelta(change),
      }
    })

    return {
      locale: snapshot.locale,
      stage: snapshot.stage,
      state,
      targetDocumentId: snapshot.targetDocumentId,
      cells,
      changed: cells.filter((cell) => cell.state !== 'same').length,
    }
  })

  return {columns: resolved, rows}
}

/**
 * Where the reviewer's eyes should start: the row carrying the heaviest change,
 * falling back to the first row so the detail pane is never empty on open.
 */
export function defaultSelection(model: GridModel): string | null {
  if (model.rows.length === 0) return null
  const ranked = [...model.rows].sort((a, b) => rowImpact(a) - rowImpact(b))
  return ranked[0].locale
}

function rowImpact(row: GridRow): number {
  if (row.state === 'failed') return -1
  if (row.state === 'missing') return 0
  return Math.min(
    ...row.cells.map((cell) => (cell.magnitude ? IMPACT[cell.magnitude] : IMPACT.unchanged)),
    IMPACT.unchanged,
  )
}
