/**
 * Workflow state → dashboard status.
 */

import type {SubjectRun, TranslationWorkflowStatus} from '@starter/l10n'
import {runPhase} from '@starter/l10n/workflows'

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
    switch (runPhase(run.stage)) {
      case 'in-progress':
        return {...flags, status: 'translating'}
      // Drift is reported, not routed around: the reviewer decides whether it matters.
      case 'review':
        return {...flags, status: run.sourceChanged ? 'stale' : 'needsReview'}
      case 'settled':
        return {...flags, status: 'approved'}
      // `failed` and anything unrecognised fall back to what the content says.
      default:
        return {...flags, status: content}
    }
  }

  return {hasFailedLocales: false, instanceId: null, sourceChanged: false, status: content}
}
