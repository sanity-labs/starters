/**
 * The object racejar threads through a browser scenario's steps.
 *
 * Same shape rule as the API suite's context (`../fixtures/context.ts`): a type
 * alias of an object literal, so it satisfies `Feature<TContext>`'s
 * `Record<string, any>` constraint, and cleared by `resetContext` in a `Before`
 * hook because racejar reuses one context object for the whole feature.
 */

import type {Session} from './session'

export type StudioJourney = {
  session: Session
  /** The locale the matrix reports a change for — the one the scenarios click. */
  locale: string
  /** How the locale document names it — what the detail pane heading shows. */
  localeTitle: string
  /** Document panes counted before the interaction under test. */
  panesBefore: number
  /** Collapsed diff toggles counted before the interaction under test. */
  deferredBefore: number
  /** The run count a section's title promised, before its pane was entered. */
  sectionCount: number
}
