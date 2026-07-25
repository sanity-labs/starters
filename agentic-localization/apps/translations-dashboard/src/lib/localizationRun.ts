/**
 * Workflow state → dashboard status.
 */

import type {SubjectRun, TranslationWorkflowStatus} from '@starter/l10n'

/** The workflow statuses plus the in-flight one an open run adds. */
export type DashboardStatus = 'translating' | TranslationWorkflowStatus

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

export function resolveLocaleStatus(args: {
  /** A fallback locale carries a direct translation. */
  fallbackTranslated: boolean
  localeTag: string
  run: SubjectRun | undefined
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
