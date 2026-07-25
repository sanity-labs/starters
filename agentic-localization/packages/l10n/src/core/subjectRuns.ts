/**
 * An open `localize-document` run, flattened off its instance.
 *
 * The parent run, named by the document it is about — its children are the
 * `LocaleRun` rows next door. Every surface that lists open runs reads the same
 * fields off the same instance, so the reading lives here and the deriving
 * stays with the surface: the inbox buckets these into sections, the dashboard
 * maps them onto per-locale statuses.
 */

import type {WorkflowInstance} from '@sanity/workflow-engine'

import {readDocumentId, readFlag, readLocaleRequests} from './instanceFields'

export interface SubjectRun {
  instanceId: string
  /** Published id of the document the run is about. */
  subjectId: string
  stage: string
  /**
   * The locales this run is working on. Empty while `analyzing` is still
   * deciding, which reads as "the whole document".
   */
  locales: readonly string[]
  /** The source moved under an open review. Advisory: the reviewer decides. */
  sourceChanged: boolean
  /** At least one locale of this run failed. Advisory: surface, never block. */
  hasFailedLocales: boolean
  startedAt: string
}

/** Null when the instance carries no readable subject — never a half-formed run. */
export function readSubjectRun(instance: WorkflowInstance): SubjectRun | null {
  const subjectId = readDocumentId(instance, 'subject')
  if (!subjectId) return null

  // A reviewer who narrowed the re-run narrowed the cohort with it.
  const requested = readLocaleRequests(instance, 'retranslateLocales')
  const targets = requested.length > 0 ? requested : readLocaleRequests(instance, 'targetLocales')

  return {
    instanceId: instance._id,
    subjectId,
    stage: instance.currentStage,
    locales: targets.map((request) => request.locale),
    sourceChanged: readFlag(instance, 'sourceChanged'),
    hasFailedLocales: readFlag(instance, 'hasFailedLocales'),
    startedAt: instance.startedAt,
  }
}
