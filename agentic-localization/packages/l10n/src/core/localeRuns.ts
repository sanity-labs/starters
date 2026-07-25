/**
 * One row per locale in an open `localize-document` run.
 *
 * Merges the locales the analysis asked for with the child runs the engine
 * actually spawned. Three engine facts shape this:
 *
 * - Subworkflow rows accumulate across stage visits, so a retried locale has
 *   one row per attempt; the newest row describes the current one.
 * - A row's `resolved.stage` is where the child ended — cohort status only
 *   says it settled, not that it succeeded.
 * - A row without `resolved` is a live child, whose stage lives on its own
 *   instance document.
 */

import {
  extractDocumentId,
  type ResolvedFieldEntry,
  type SubworkflowEntry,
} from '@sanity/workflow-engine'

import {readDocumentId, readProgress, readText, type LocaleRequest} from './instanceFields'

export type LocaleRunStage = 'queued' | 'translating' | 'translated' | 'failed'

export interface ChildRun {
  instanceId: string
  stage: LocaleRunStage
  progress: number | null
  targetDocumentId: string | null
  /** The revision the machine draft landed at, for the learning loop to diff. */
  machineRev: string | null
}

export interface LocaleRun {
  locale: string
  reason?: string
  stage: LocaleRunStage
  progress: number | null
  childInstanceId: string | null
  targetDocumentId: string | null
  machineRev: string | null
}

function toStage(stage: string | undefined): LocaleRunStage {
  if (stage === 'translated') return 'translated'
  if (stage === 'translating') return 'translating'
  return 'failed'
}

export function toChildRun(instance: {
  _id: string
  currentStage: string
  fields: readonly ResolvedFieldEntry[]
}): ChildRun {
  return {
    instanceId: instance._id,
    stage: toStage(instance.currentStage),
    progress: readProgress(instance.fields, 'translationProgress'),
    targetDocumentId: readDocumentId(instance.fields, 'target'),
    machineRev: readText(instance.fields, 'machineRev'),
  }
}

export function buildLocaleRuns({
  targetLocales,
  subworkflows,
  children,
}: {
  targetLocales: readonly LocaleRequest[]
  subworkflows: readonly SubworkflowEntry[]
  children: readonly ChildRun[]
}): LocaleRun[] {
  const newestRow = new Map<string, SubworkflowEntry>()
  for (const row of subworkflows) {
    const held = newestRow.get(row.rowKey)
    if (!held || held.spawnedAt <= row.spawnedAt) newestRow.set(row.rowKey, row)
  }

  const childById = new Map(children.map((child) => [child.instanceId, child]))
  const reasonByLocale = new Map(targetLocales.map((request) => [request.locale, request.reason]))
  const locales = [
    ...new Set([...targetLocales.map((request) => request.locale), ...newestRow.keys()]),
  ].sort()

  return locales.map((locale): LocaleRun => {
    const reason = reasonByLocale.get(locale)
    const row = newestRow.get(locale)
    if (!row) {
      return {
        locale,
        reason,
        stage: 'queued',
        progress: null,
        childInstanceId: null,
        targetDocumentId: null,
        machineRev: null,
      }
    }

    const childInstanceId = extractDocumentId(row.ref.id)
    const child = childById.get(childInstanceId)
    return {
      locale,
      reason,
      stage: row.resolved ? toStage(row.resolved.stage) : (child?.stage ?? 'translating'),
      progress: child?.progress ?? null,
      childInstanceId,
      targetDocumentId: child?.targetDocumentId ?? null,
      machineRev: child?.machineRev ?? null,
    }
  })
}

/**
 * Every child instance a row points at, resolved or not.
 *
 * Deliberately not "live children only". The engine stops watching a child the
 * moment it stamps `resolved`, and that stamp is exactly what lets the parent
 * leave `translating` — so by the time a reviewer opens the run, every row is
 * resolved. `resolved` caches the child's stage but none of its fields, so a
 * row filtered out here has no `target` and the reviewer gets no compare on the
 * one stage that exists for comparing. Reading a terminal instance is cheap and
 * safe: terminal state is immutable.
 */
export function childInstanceIds(subworkflows: readonly SubworkflowEntry[]): string[] {
  return [...new Set(subworkflows.map((row) => extractDocumentId(row.ref.id)))]
}
