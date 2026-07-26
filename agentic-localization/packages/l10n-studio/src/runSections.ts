/**
 * The editor's inbox, as four questions the engine alone can answer.
 *
 * Run state lives in the workflows dataset, so no content GROQ can join it: a
 * section is a set of subject ids the engine names, and the list under it is
 * built from those ids rather than from a filter. The ids arrive here from the
 * one instance subscription `LocalizationRunsSubscriber` mounts, and leave
 * through `localizationRuns$` — which `structure.ts` reads outside React, the
 * same bridge `globalLocaleFilter$` is for the locale filter.
 *
 * Membership is deliberately not exclusive. A review that also has a failed
 * locale is two jobs, and the editor should find it under both.
 */

import type {SubjectRun} from '@starter/l10n'
import {runPhase} from '@starter/l10n/workflows'
import {BehaviorSubject} from 'rxjs'

export const RUN_SECTIONS = [
  'needs-review',
  'translating',
  'source-changed',
  'failed-locales',
] as const

export type RunSectionId = (typeof RUN_SECTIONS)[number]

export type RunSections = Record<RunSectionId, readonly SubjectRun[]>

export const EMPTY_RUN_SECTIONS: RunSections = {
  'needs-review': [],
  translating: [],
  'source-changed': [],
  'failed-locales': [],
}

/**
 * Every section this run belongs in. `failed-locales` covers the whole-run
 * `failed` stage too: from the inbox both read as "this needs a human".
 */
export function sectionsFor(run: SubjectRun): RunSectionId[] {
  const phase = runPhase(run.stage)
  const sections: RunSectionId[] = []
  if (phase === 'in-progress') sections.push('translating')
  if (phase === 'review') sections.push(run.sourceChanged ? 'source-changed' : 'needs-review')
  if (run.hasFailedLocales || phase === 'failed') sections.push('failed-locales')
  return sections
}

/** Oldest first: the run that has waited longest is the one to pick up. */
function byAge(a: SubjectRun, b: SubjectRun): number {
  if (a.startedAt !== b.startedAt) return a.startedAt < b.startedAt ? -1 : 1
  return a.instanceId < b.instanceId ? -1 : 1
}

/**
 * One row per subject, in every section it belongs to.
 *
 * The `one-open-localization` guard means a subject has at most one open run,
 * but a lake that briefly shows two must not produce two rows: the newest wins,
 * because that is the run the document's own inspector is driving.
 */
export function bucketRuns(runs: readonly SubjectRun[]): RunSections {
  const newest = new Map<string, SubjectRun>()
  for (const run of runs) {
    const held = newest.get(run.subjectId)
    if (!held || byAge(held, run) < 0) newest.set(run.subjectId, run)
  }

  const rows: Record<RunSectionId, SubjectRun[]> = {
    'needs-review': [],
    translating: [],
    'source-changed': [],
    'failed-locales': [],
  }

  for (const run of [...newest.values()].sort(byAge)) {
    for (const section of sectionsFor(run)) rows[section].push(run)
  }

  return rows
}

/** Identity for the structure: re-emitting the same inbox must not rebuild panes. */
export function sectionsEqual(a: RunSections, b: RunSections): boolean {
  return RUN_SECTIONS.every((section) => {
    const left = a[section]
    const right = b[section]
    return (
      left.length === right.length &&
      left.every((run, index) => {
        const other = right[index]
        return (
          run.instanceId === other.instanceId &&
          run.subjectId === other.subjectId &&
          run.stage === other.stage &&
          run.sourceChanged === other.sourceChanged &&
          run.hasFailedLocales === other.hasFailedLocales &&
          run.locales.length === other.locales.length &&
          run.locales.every((locale, i) => locale === other.locales[i])
        )
      })
    )
  })
}

/**
 * The inbox as the structure and its panes read it. Written by the single
 * subscriber in the Studio layout; read outside React by `withRunSections` and
 * inside it by `RunSectionPane`.
 */
export const localizationRuns$ = new BehaviorSubject<RunSections>(EMPTY_RUN_SECTIONS)

export function publishLocalizationRuns(next: RunSections): void {
  if (!sectionsEqual(localizationRuns$.getValue(), next)) localizationRuns$.next(next)
}
