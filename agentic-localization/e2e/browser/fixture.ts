/**
 * What the two inspector journeys need from the environment, asked once.
 *
 * Both drive a sample document by id, and both have a scenario that needs a
 * locale with something to read: a row whose diff the detail pane can defer, a
 * cell whose field it can offer to edit. Neither is pinned.
 *
 * The document is a bootstrap artefact, so its absence is one GROQ read. Which
 * locale has a diff is **run state, not fixture state** — the matrix reports a
 * locale as changed while its pending revision differs from its published one,
 * so the row carrying a diff at ten past the hour is translated and quiet by
 * twenty past, and a different row has taken its place. Naming a code there
 * makes a journey green or red by the clock, so this reads the grid's own
 * coverage labels instead and hands over whatever it found.
 */

import type {Session} from './session'
import type {GateReason} from './gate'

import {missingSampleDocument, namedLocales} from './content'
import {settle} from './session'
import {changedLocale, documentPath, matrixRows, showGrid} from './studio'

/** The sample document a journey drives, and the field its scenarios open. */
export interface Subject {
  readonly type: string
  readonly id: string
  readonly field: string
}

/** One answer per conditional tag, plus the locale the open gate yields. */
export interface MatrixFixture {
  /**
   * The dev dataset has no such document — closes `@requires-sample-data`,
   * which both features carry at feature level, so it skips every scenario.
   */
  readonly missing: GateReason
  /** No row reports a change to read — closes `@requires-changed-locale`. */
  readonly unchanged: GateReason
  /** The locale the scenarios click. Empty unless both gates are open. */
  readonly locale: string
  /** How the locale document names it. Empty unless both gates are open. */
  readonly localeTitle: string
}

/** A closed gate carries no locale: the scenarios that would read one are skipped. */
function closed(gate: Pick<MatrixFixture, 'missing' | 'unchanged'>): MatrixFixture {
  return {...gate, locale: '', localeTitle: ''}
}

export async function readMatrixFixture(
  session: Session,
  subject: Subject,
): Promise<MatrixFixture> {
  const missing = await missingSampleDocument(subject.id)
  // The feature-level gate has already skipped every scenario, so the narrower
  // tag stays open rather than printing the same reason a second time.
  if (missing) return closed({missing, unchanged: undefined})

  const {page} = session
  await session.goto(documentPath(subject.type, subject.id, {inspect: 'translations'}))
  await settle(matrixRows(page).first(), 'the first locale row', page)
  await showGrid(page)

  const code = await changedLocale(page, subject.field)

  if (code === undefined) {
    return closed({
      missing: undefined,
      unchanged:
        `no locale row reports a change to "${subject.field}" on ${subject.id} — every ` +
        'translation is up to date, so there is no diff for these scenarios to read. ' +
        'Publish a source edit and let the run translate.',
    })
  }

  const named = (await namedLocales()).find((locale) => locale.code === code)
  if (!named) {
    return closed({
      missing: undefined,
      unchanged: `the matrix lists "${code}", which is not a configured locale`,
    })
  }

  return {missing: undefined, unchanged: undefined, locale: named.code, localeTitle: named.title}
}
