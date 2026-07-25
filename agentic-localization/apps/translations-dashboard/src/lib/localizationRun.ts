/**
 * Workflow state → dashboard status.
 *
 * The state split the migration locked in: the instance owns workflow state
 * (which locales are in flight, whether a review is open, whether the source
 * moved), `translation.metadata` owns content state (a translation exists, a
 * fallback covers the gap). This module is the only place the two meet, and the
 * only place `localize-document`'s stage names are interpreted.
 */

import type {TranslationWorkflowStatus} from '@starter/l10n'
import type {WorkflowInstance} from '@sanity/workflow-engine'

import {readDocumentId, readFlag, readLocaleRequests} from '@starter/l10n'

/** The workflow statuses plus the in-flight one an open run adds. */
export type DashboardStatus = 'translating' | TranslationWorkflowStatus

/** An open `localize-document` run, flattened to what the dashboard reads. */
export interface LocalizationRun {
  /** At least one locale of this run failed. Advisory: surface, never block. */
  hasFailedLocales: boolean
  instanceId: string
  /**
   * The locales this run is working on. Empty while `analyzing` is still
   * deciding, which reads as "the whole document".
   */
  locales: string[]
  /** The source moved under an open review. Advisory: the reviewer decides. */
  sourceChanged: boolean
  stage: string
  startedAt: string
  /** Published id of the document the run is about. */
  subjectId: string
}

/** One document × locale cell: its status plus the run flags behind it. */
export interface LocaleStatus {
  hasFailedLocales: boolean
  /** Set when this locale sits inside an open run. */
  instanceId: null | string
  sourceChanged: boolean
  status: DashboardStatus
}

/** Stages where the engine is doing the work. */
const IN_PROGRESS_STAGES = new Set(['analyzing', 'translating'])

/** Terminal-success stages, seen only before the instance settles out of the list. */
const SETTLED_STAGES = new Set(['approved', 'done'])

/** Null when the instance carries no readable subject — never a half-formed run. */
export function runFromInstance(instance: WorkflowInstance): LocalizationRun | null {
  const subjectId = readDocumentId(instance, 'subject')
  if (!subjectId) return null

  // A reviewer who narrowed the re-run narrowed the cohort with it.
  const requested = readLocaleRequests(instance, 'retranslateLocales')
  const targets = requested.length > 0 ? requested : readLocaleRequests(instance, 'targetLocales')

  return {
    hasFailedLocales: readFlag(instance, 'hasFailedLocales'),
    instanceId: instance._id,
    locales: targets.map((request) => request.locale),
    sourceChanged: readFlag(instance, 'sourceChanged'),
    stage: instance.currentStage,
    startedAt: instance.startedAt,
    subjectId,
  }
}

export function resolveLocaleStatus(args: {
  /** A fallback locale carries a direct translation. */
  fallbackTranslated: boolean
  localeTag: string
  run: LocalizationRun | undefined
  /** This locale carries a direct translation. */
  translated: boolean
}): LocaleStatus {
  const {fallbackTranslated, localeTag, run, translated} = args

  const content: DashboardStatus = translated
    ? 'approved'
    : fallbackTranslated
      ? 'usingFallback'
      : 'missing'

  if (run && (run.locales.length === 0 || run.locales.includes(localeTag))) {
    const flags = {
      hasFailedLocales: run.hasFailedLocales,
      instanceId: run.instanceId,
      sourceChanged: run.sourceChanged,
    }
    if (IN_PROGRESS_STAGES.has(run.stage)) return {...flags, status: 'translating'}
    // Drift is reported, not routed around: the reviewer decides whether it matters.
    if (run.stage === 'review') {
      return {...flags, status: run.sourceChanged ? 'stale' : 'needsReview'}
    }
    if (SETTLED_STAGES.has(run.stage)) return {...flags, status: 'approved'}
    // `failed` and anything unrecognised fall back to what the content says.
    return {...flags, status: content}
  }

  return {hasFailedLocales: false, instanceId: null, sourceChanged: false, status: content}
}
