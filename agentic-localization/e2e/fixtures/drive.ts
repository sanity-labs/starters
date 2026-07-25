/**
 * Mode P: the harness plays the effect handlers.
 *
 * The op literals are the ones `analyzeSource` and `translateLocale` really
 * write — the same set `localizeDocument.test.ts` reports on the bench. What
 * differs is everything underneath: a deployed definition, a real instance
 * document, real lake guards, and the Functions in front.
 */

import type {FieldOp, WorkflowInstance} from '@sanity/workflow-engine'
import type {Harness} from './harness'

import {ANALYZE_SOURCE, TRANSLATE_LOCALE} from '@starter/l10n/workflows'

export interface LocaleRequest {
  locale: string
  reason: string
}

function set(field: string, value: unknown): FieldOp {
  return {type: 'field.set', target: {scope: 'workflow', field}, value: {type: 'literal', value}}
}

/**
 * Report the analysis verdict.
 *
 * `analyzedRev` is read back through the instance's own scope rather than from
 * the document: the handler records the revision the engine hydrated under the
 * run's perspective, and any other value would make `source-changed` fire on
 * every tick.
 */
export async function reportAnalysis(
  harness: Harness,
  instanceId: string,
  args: {materiality: 'cosmetic' | 'material' | 'minor'; locales: LocaleRequest[]},
): Promise<void> {
  const analyzedRev = await harness.engine.queryInScope<null | string>({
    instanceId,
    groq: '$fields.subject._rev',
  })

  await harness.complete({
    instanceId,
    effect: ANALYZE_SOURCE,
    ops: [
      ...(analyzedRev ? [set('analyzedRev', analyzedRev)] : []),
      set('materiality', args.materiality),
      set('targetLocales', args.locales),
      set('explanation', `${args.locales.length} locale(s) need work.`),
    ],
  })
}

/**
 * Settle every locale child still awaiting its translation, oldest first.
 *
 * `children()` returns the children of every stage visit, so a re-entered
 * `translating` sees earlier settled cohorts alongside the fresh one — only the
 * children with the effect still pending are playable.
 */
export async function settleLocales(
  harness: Harness,
  instanceId: string,
  status: 'done' | 'failed' = 'done',
): Promise<WorkflowInstance[]> {
  const settled: WorkflowInstance[] = []
  for (const child of await harness.engine.children({instanceId})) {
    const pending = await harness.pendingEffects(child._id)
    if (!pending.some((effect) => effect.name === TRANSLATE_LOCALE)) continue
    await harness.complete({instanceId: child._id, effect: TRANSLATE_LOCALE, status})
    settled.push(child)
  }
  return settled
}

/** Settle the named locale's child, leaving its siblings pending. */
export async function settleLocale(
  harness: Harness,
  instanceId: string,
  locale: string,
  status: 'done' | 'failed' = 'done',
): Promise<void> {
  for (const child of await harness.engine.children({instanceId})) {
    if (localeOf(child) !== locale) continue
    const pending = await harness.pendingEffects(child._id)
    if (!pending.some((effect) => effect.name === TRANSLATE_LOCALE)) continue
    await harness.complete({instanceId: child._id, effect: TRANSLATE_LOCALE, status})
    return
  }
  throw new Error(`[e2e] no locale child awaiting translation for ${locale}`)
}

/** The target locale a child run was spawned for. */
export function localeOf(child: WorkflowInstance): string | undefined {
  const value = child.fields.find((field) => field.name === 'locale')?.value
  return typeof value === 'string' ? value : undefined
}
