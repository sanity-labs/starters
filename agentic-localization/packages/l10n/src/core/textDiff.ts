/**
 * The one text diff in this starter, over `@sanity/diff`.
 *
 * `@sanity/diff` is character-granular with `cleanupSemantic` — right for
 * unsegmented scripts, where a word tokenizer turns a CJK edit into
 * per-ideograph confetti, and wrong for space-delimited ones, where it happily
 * cuts a word in half (`Nyheter` → `Viktiga nyheter` arrives as removed `N`,
 * added `Viktiga n`). `alignToWords` closes that gap: a change run grows
 * outwards over token characters until it hits a boundary, so Latin text reads
 * word-granular while CJK — which has no token characters by this definition —
 * is left exactly as the semantic cleanup produced it.
 *
 * Both the AI prompt path (`buildFieldSummary`) and the reviewer's rendered diff
 * read these segments, so the two can never disagree about what changed.
 */

import {diffInput, wrap} from '@sanity/diff'

import {extractBlockText} from './extractBlockText'

/** A run of text, and whether it survived the edit. */
export interface TextSegment {
  action: 'added' | 'removed' | 'unchanged'
  text: string
}

/**
 * One block position in a Portable Text compare.
 *
 * `changed` is a block whose text was edited in place — its old and new text
 * belong on one row so the reviewer reads a word diff rather than a red block
 * followed by a green one. `moved` is the same text at a different index, which
 * `@sanity/diff` reports through `hasMoved` and a positional diff can only
 * report as a spurious removal plus addition.
 */
export interface BlockChange {
  /** 1-based position: in the new document where the block still exists, in the old where it does not. */
  blockNumber: number
  type: 'added' | 'changed' | 'context' | 'moved' | 'removed' | 'separator'
  oldText?: string
  newText?: string
}

/** Letters, marks and digits of scripts that delimit their words with spaces. */
const TOKEN_CHAR = /[\p{L}\p{M}\p{N}]/u

/** Scripts that run words together, where growing a change to a word boundary would swallow the sentence. */
const UNSEGMENTED =
  /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Hangul}\p{sc=Thai}\p{sc=Lao}\p{sc=Khmer}\p{sc=Myanmar}]/u

function isTokenChar(char: string): boolean {
  return TOKEN_CHAR.test(char) && !UNSEGMENTED.test(char)
}

/** Length of the trailing partial token in `text`. */
function tokenTail(text: string): number {
  let length = 0
  while (length < text.length && isTokenChar(text[text.length - 1 - length]!)) length++
  return length
}

/** Length of the leading partial token in `text`. */
function tokenHead(text: string): number {
  let length = 0
  while (length < text.length && isTokenChar(text[length]!)) length++
  return length
}

/** A change run, with the unchanged text that precedes it. */
interface ChangeRun {
  before: string
  removed: string
  added: string
}

/**
 * Runs are walked left to right so each only ever borrows unchanged text that no
 * earlier run has already claimed.
 *
 * Hand-rolled because there is nothing to adopt: `@sanity/diff-match-patch`
 * (3.2.0, what `@sanity/diff` runs on) exports no word-mode helper — only
 * `cleanupSemantic` and `cleanupEfficiency` over character diffs.
 */
function alignToWords(segments: readonly TextSegment[]): TextSegment[] {
  const runs: ChangeRun[] = []
  let trailing = ''

  for (const segment of segments) {
    if (segment.action === 'unchanged') {
      trailing += segment.text
      continue
    }
    const open = trailing === '' ? runs[runs.length - 1] : undefined
    if (open) {
      if (segment.action === 'removed') open.removed += segment.text
      else open.added += segment.text
      continue
    }
    runs.push({
      before: trailing,
      removed: segment.action === 'removed' ? segment.text : '',
      added: segment.action === 'added' ? segment.text : '',
    })
    trailing = ''
  }

  // Moving text into both sides of a run leaves the two reconstructed strings
  // byte-identical, so this pass can only change where the boundaries fall.
  for (let index = 0; index < runs.length; index++) {
    const run = runs[index]!
    const changed = run.removed || run.added
    if (changed === '') continue

    if (isTokenChar(changed[0]!)) {
      const borrowed = tokenTail(run.before)
      const prefix = run.before.slice(run.before.length - borrowed)
      run.before = run.before.slice(0, run.before.length - borrowed)
      run.removed = prefix + run.removed
      run.added = prefix + run.added
    }

    if (isTokenChar(changed.at(-1)!)) {
      const following = runs[index + 1]
      const after = following ? following.before : trailing
      const suffix = after.slice(0, tokenHead(after))
      run.removed += suffix
      run.added += suffix
      if (following) following.before = after.slice(suffix.length)
      else trailing = after.slice(suffix.length)
    }
  }

  const aligned: TextSegment[] = []
  const push = (action: TextSegment['action'], text: string) => {
    if (text !== '') aligned.push({action, text})
  }
  for (const run of runs) {
    push('unchanged', run.before)
    push('removed', run.removed)
    push('added', run.added)
  }
  push('unchanged', trailing)
  return aligned
}

/**
 * Word-aligned segments between two plain-text values.
 *
 * Never emits an empty segment, so "nothing changed" reads off the absence of an
 * added or removed one.
 */
export function diffTextSegments(fromText: string, toText: string): TextSegment[] {
  const diff = diffInput<null>(wrap(fromText, null), wrap(toText, null))
  if (diff.type !== 'string') return [{action: 'unchanged', text: toText}]
  return alignToWords(diff.segments)
}

/** Characters the edit touched, counted on both sides — the magnitude numerator. */
export function changedCharCount(segments: readonly TextSegment[]): number {
  return segments.reduce(
    (total, segment) => (segment.action === 'unchanged' ? total : total + segment.text.length),
    0,
  )
}

/** Unchanged blocks kept on either side of a change group, for orientation. */
const CONTEXT_BLOCKS = 1

/** A block that only exists on the old side, and where it sat in the new sequence. */
interface Removal {
  fromIndex: number
  /** New-side position the block was removed from ahead of. */
  anchor: number
}

/**
 * Block-level compare of two Portable Text arrays, on their plain text.
 *
 * Per @ux: "Translators need 'what words changed?', not 'which marks
 * changed?'" — so marks and annotations never reach the diff. Blocks align on
 * their text rather than their `_key`, because a run rewrites the array
 * wholesale and the keys it emits are not the keys it replaced.
 */
export function diffBlockTexts(oldBlocks: unknown[], newBlocks: unknown[]): BlockChange[] {
  const oldTexts = oldBlocks.map(extractBlockText)
  const newTexts = newBlocks.map(extractBlockText)

  const diff = diffInput<null>(wrap(oldTexts, null), wrap(newTexts, null))
  if (diff.type !== 'array') return []

  // `ItemDiff[]` order is not positional — its comparator puts every removal
  // ahead of every addition — so the new sequence is rebuilt from the indices
  // rather than read off the item order.
  const survivors = new Map<number, {fromIndex: number; hasMoved: boolean}>()
  const additions = new Set<number>()
  const removals: Removal[] = []

  for (const item of diff.items) {
    const {fromIndex, toIndex} = item
    if (toIndex === undefined) {
      if (fromIndex !== undefined) removals.push({fromIndex, anchor: newTexts.length})
      continue
    }
    if (fromIndex === undefined) {
      additions.add(toIndex)
      continue
    }
    survivors.set(toIndex, {fromIndex, hasMoved: item.hasMoved})
  }

  // A removal sits immediately before the first surviving block that followed
  // it on the old side; with none left it belongs at the end.
  for (const removal of removals) {
    for (const [toIndex, survivor] of survivors) {
      if (survivor.fromIndex > removal.fromIndex && toIndex < removal.anchor) {
        removal.anchor = toIndex
      }
    }
  }
  removals.sort((a, b) => a.fromIndex - b.fromIndex)

  const rows: BlockChange[] = []
  const emitRemovals = (anchor: number) => {
    for (const removal of removals) {
      if (removal.anchor !== anchor) continue
      rows.push({
        blockNumber: removal.fromIndex + 1,
        type: 'removed',
        oldText: oldTexts[removal.fromIndex],
      })
    }
  }

  for (let toIndex = 0; toIndex < newTexts.length; toIndex++) {
    emitRemovals(toIndex)
    const survivor = survivors.get(toIndex)
    if (survivor) {
      rows.push({
        blockNumber: toIndex + 1,
        type: survivor.hasMoved ? 'moved' : 'context',
        oldText: oldTexts[survivor.fromIndex],
        newText: newTexts[toIndex],
      })
      continue
    }
    if (additions.has(toIndex)) {
      rows.push({blockNumber: toIndex + 1, type: 'added', newText: newTexts[toIndex]})
    }
  }
  emitRemovals(newTexts.length)

  return withContext(pairEdits(rows))
}

/**
 * An addition next to a removal is one block whose text was edited.
 *
 * Zipping a whole adjacent group rather than merging one pair keeps a
 * multi-block rewrite lined up: two additions followed by two removals are two
 * edits, not one edit and two orphans.
 */
function pairEdits(rows: readonly BlockChange[]): BlockChange[] {
  const result: BlockChange[] = []
  let index = 0

  while (index < rows.length) {
    const start = index
    while (
      index < rows.length &&
      (rows[index]!.type === 'added' || rows[index]!.type === 'removed')
    ) {
      index++
    }
    if (index === start) {
      result.push(rows[start]!)
      index++
      continue
    }

    const group = rows.slice(start, index)
    const added = group.filter((row) => row.type === 'added')
    const removed = group.filter((row) => row.type === 'removed')
    const paired = Math.min(added.length, removed.length)

    for (let offset = 0; offset < paired; offset++) {
      result.push({
        blockNumber: added[offset]!.blockNumber,
        type: 'changed',
        oldText: removed[offset]!.oldText,
        newText: added[offset]!.newText,
      })
    }
    result.push(...added.slice(paired), ...removed.slice(paired))
  }

  return result
}

/**
 * Drop the unchanged blocks a reviewer does not need, keeping one on either side
 * of each change group and marking every gap the way a hunk header does.
 */
function withContext(rows: readonly BlockChange[]): BlockChange[] {
  const keep = new Set<number>()
  for (let index = 0; index < rows.length; index++) {
    if (rows[index]!.type === 'context') continue
    keep.add(index)
    for (let before = index - 1, taken = 0; before >= 0 && taken < CONTEXT_BLOCKS; before--) {
      if (rows[before]!.type !== 'context') break
      keep.add(before)
      taken++
    }
    for (let after = index + 1, taken = 0; after < rows.length && taken < CONTEXT_BLOCKS; after++) {
      if (rows[after]!.type !== 'context') break
      keep.add(after)
      taken++
    }
  }

  const result: BlockChange[] = []
  let lastKept = -1
  for (let index = 0; index < rows.length; index++) {
    if (!keep.has(index)) continue
    if (lastKept >= 0 && index - lastKept > 1) result.push({blockNumber: 0, type: 'separator'})
    result.push(rows[index]!)
    lastKept = index
  }
  return result
}
