/**
 * What the Studio's localization surfaces look like from the outside.
 *
 * The plugin authors no `data-testid`, so every hook here is an `aria-label`, a
 * role, or user-visible copy — which is the right constraint: a journey that
 * cannot find a control by the name a screen reader would announce is a journey
 * an editor could not follow either. Where the copy is the only hook, it is the
 * feature file that names it, not this module.
 *
 * Studio's own testids (`document-pane`, `pane-item-*`) are stable API and are
 * used as-is.
 */

import type {Locator, Page} from 'playwright'

/** The document inspector panel. Studio sets this; the plugin sets nothing. */
export function inspector(page: Page): Locator {
  return page.locator('aside[data-ui="DocumentInspectorPanel"]')
}

/** The toolbar button that opens the inspector — its title carries the run badge. */
export function inspectorButton(page: Page): Locator {
  return page.getByRole('button', {name: /^Translations/})
}

export function documentPanes(page: Page): Locator {
  return page.getByTestId('document-pane')
}

export function documentTitles(page: Page): Locator {
  return page.getByTestId('document-panel-document-title')
}

/** Every locale row in the matrix, in render order. */
export function matrixRows(page: Page): Locator {
  return inspector(page).getByRole('button', {name: /^Show what changed in /})
}

export function matrixRow(page: Page, locale: string): Locator {
  return inspector(page).getByRole('button', {name: `Show what changed in ${locale}`})
}

/**
 * One `(locale, field)` cell. The label ends in the coverage state, so matching
 * a prefix is what lets a step name the cell without pinning its state.
 */
export function matrixCell(page: Page, locale: string, field: string): Locator {
  return inspector(page).getByRole('button', {
    name: new RegExp(`^${escape(locale)}, ${escape(field)}: `),
  })
}

/** The `›` affordance that opens a locale's own document beside the source. */
export function openLocaleButton(page: Page, locale: string): Locator {
  return inspector(page).getByRole('button', {name: `Open ${locale}`})
}

export function columnHeaders(page: Page): Locator {
  return inspector(page).getByRole('columnheader')
}

/** The `Rows` / `Grid` toggle. Only rendered once a type has six or more fields. */
export function presentationButton(page: Page, presentation: 'Grid' | 'Rows'): Locator {
  return inspector(page).getByRole('button', {name: presentation, exact: true})
}

/** The review verbs. Their text comes from the workflow definition, not i18n. */
export function reviewAction(page: Page, text: string): Locator {
  return inspector(page).getByRole('button', {name: text, exact: true})
}

/** Studio encodes a document pane as `type;id`, and its params after commas. */
export function documentPath(
  type: string,
  id: string,
  params: Record<string, string> = {},
): string {
  const entries = Object.entries(params).map(([key, value]) => `,${key}=${value}`)
  return `/structure/${type};${id}${entries.join('')}`
}

/**
 * Every coverage state the grid can report, as the cell labels spell them.
 * `Failed` is a real state that the legend omits — an asymmetry worth pinning.
 */
export const COVERAGE_STATES = [
  'Unchanged',
  'Minor',
  'Updated',
  'Rewritten',
  'Missing',
  'Failed',
] as const

/** The trailing word of a `"<locale>, <field>: <state>"` cell label. */
export function coverageStateOf(label: string): string {
  return label.slice(label.lastIndexOf(': ') + 2)
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
