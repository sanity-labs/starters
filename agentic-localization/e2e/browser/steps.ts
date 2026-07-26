/**
 * Step definitions shared by the Studio journeys.
 *
 * Both tiers drive the same inspector — one matrix component, tier as a prop —
 * so the steps that open it, read its grid and read its detail pane are written
 * once here, and each feature file adds only what is its own.
 */

import type {StepDefinition, StepDefinitionCallback} from 'racejar'
import type {StudioJourney} from './context'

import {Given, Then, When} from 'racejar'
import {expect} from 'vitest'

import {targetLocales} from './content'
import {settle} from './session'
import {
  cellLabels,
  columnHeaders,
  COVERAGE_STATES,
  coverageStateOf,
  documentPanes,
  documentPath,
  documentTitles,
  inspector,
  inspectorButton,
  matrixCell,
  matrixRow,
  matrixRows,
  openLocaleButton,
  showGrid,
} from './studio'

/**
 * One text, registered for both keywords — the browser twin of the API suite's
 * `contextAndAction`. Separate rather than shared because that one pins the
 * context type to the API journeys' harness.
 */
export function contextAndAction<A = undefined, B = undefined>(
  text: string,
  callback: StepDefinitionCallback<StudioJourney, A, B>,
): StepDefinition<StudioJourney, A, B>[] {
  return [Given<StudioJourney, A, B>(text, callback), When<StudioJourney, A, B>(text, callback)]
}

/** A comma-separated step argument, as a list. */
function list(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

/** The collapsed long-diff toggles, which a focused field opens. */
function deferredDiffs(context: StudioJourney) {
  return inspector(context.session.page).getByRole('button', {name: /^Show diff \(/})
}

export const studioSteps = [
  ...contextAndAction<string, string>(
    'the Studio is open on the {string} document {string}',
    async (context, type, id) => {
      await context.session.goto(documentPath(type, id))
      await settle(
        documentPanes(context.session.page).first(),
        `the ${type} document pane`,
        context.session.page,
      )
    },
  ),

  ...contextAndAction('the reviewer opens the Translations inspector', async (context) => {
    const {page} = context.session
    await settle(inspectorButton(page), 'the Translations toolbar button', page)
    await inspectorButton(page).click()
    await settle(inspector(page), 'the Translations inspector', page)
    // The matrix is derived from content the pane is still streaming in.
    await settle(matrixRows(page).first(), 'the first locale row', page)
  }),

  Then<StudioJourney>('the inspector is open', async (context) => {
    expect(await inspector(context.session.page).count()).toBe(1)
  }),

  Then<StudioJourney>(
    'the matrix has a row for every configured target locale',
    async (context) => {
      const labels = await matrixRows(context.session.page).evaluateAll((rows: Element[]) =>
        rows.map((row) => row.getAttribute('aria-label') ?? ''),
      )
      const shown = labels.map((label) => label.replace('Show what changed in ', '')).sort()
      expect(shown).toEqual(await targetLocales())
    },
  ),

  ...contextAndAction('the matrix is shown as a grid', async (context) => {
    await showGrid(context.session.page)
  }),

  Then<StudioJourney, string>('the grid columns are {string}', async (context, fields) => {
    expect(await columnHeaders(context.session.page).allInnerTexts()).toEqual(list(fields))
  }),

  Then<StudioJourney>(
    'every cell reports one of the documented coverage states',
    async (context) => {
      const labels = await cellLabels(context.session.page)
      const rows = await matrixRows(context.session.page).count()
      const columns = await columnHeaders(context.session.page).count()

      expect(labels).toHaveLength(rows * columns)
      for (const label of labels) {
        expect(COVERAGE_STATES, label).toContain(coverageStateOf(label))
      }
    },
  ),

  Then<StudioJourney, string>('the legend names {string}', async (context, states) => {
    for (const state of list(states)) {
      await settle(
        inspector(context.session.page).getByText(state, {exact: true}),
        `the "${state}" legend entry`,
        context.session.page,
      )
    }
  }),

  ...contextAndAction("the reviewer selects the changed locale's row", async (context) => {
    await matrixRow(context.session.page, context.locale).click()
  }),

  ...contextAndAction<string>(
    "the reviewer selects the changed locale's cell for {string}",
    async (context, field) => {
      context.deferredBefore = await deferredDiffs(context).count()
      await matrixCell(context.session.page, context.locale, field).click()
    },
  ),

  Then<StudioJourney>('the detail pane names the changed locale', async (context) => {
    await settle(
      inspector(context.session.page).getByText(context.localeTitle, {exact: true}),
      `the detail pane heading for "${context.localeTitle}"`,
      context.session.page,
    )
  }),

  Then<StudioJourney, string>('the detail pane offers to edit {string}', async (context, field) => {
    await settle(
      inspector(context.session.page).getByRole('button', {name: `Edit ${field}`}),
      `the "Edit ${field}" affordance`,
      context.session.page,
    )
  }),

  Then<StudioJourney>(
    'the detail pane keeps at least one long diff behind a toggle',
    async (context) => {
      await settle(deferredDiffs(context).first(), 'a collapsed diff toggle', context.session.page)
    },
  ),

  Then<StudioJourney>('fewer long diffs are behind a toggle than before', async (context) => {
    expect(await deferredDiffs(context).count()).toBeLessThan(context.deferredBefore)
  }),

  ...contextAndAction(
    "the reviewer opens the changed locale's document from its row",
    async (context) => {
      context.panesBefore = await documentPanes(context.session.page).count()
      await openLocaleButton(context.session.page, context.locale).click()
    },
  ),

  Then<StudioJourney>('a further document pane opens beside the source', async (context) => {
    await settle(
      documentPanes(context.session.page).nth(context.panesBefore),
      'the sibling document pane',
      context.session.page,
    )
    expect(await documentPanes(context.session.page).count()).toBe(context.panesBefore + 1)
  }),

  Then<StudioJourney>('the new pane holds a different document', async (context) => {
    // The pane is mounted before its document resolves, so the title is its own
    // wait rather than something the previous step already guaranteed.
    await settle(
      documentTitles(context.session.page).nth(context.panesBefore),
      'the sibling pane’s document title',
      context.session.page,
    )
    const titles = await documentTitles(context.session.page).allInnerTexts()
    expect(titles).toHaveLength(context.panesBefore + 1)
    expect(new Set(titles).size).toBe(titles.length)
  }),
]
