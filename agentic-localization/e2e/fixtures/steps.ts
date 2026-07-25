/**
 * Step definitions shared by the journeys.
 *
 * `Given`/`When`/`Then` come straight from `racejar` with the context type
 * supplied per call — no typed re-export wrapper. racejar matches a step by its
 * keyword type first, so the same text can be registered as both a `Given` and a
 * `When` without colliding, which is what `contextAndAction` does.
 */

import type {WorkflowInstance} from '@sanity/workflow-engine'
import type {StepDefinition, StepDefinitionCallback} from 'racejar'
import type {L10nContext} from './context'

import {abortReason} from '@sanity/workflow-engine'
import {TRANSLATE_LOCALE} from '@starter/l10n/workflows'
import {Given, Then, When} from 'racejar'
import {expect} from 'vitest'

import {localeOf, reportAnalysis, settleLocale, settleLocales} from './drive'
import {deliverDelete, deliverPublish} from './events'
import {fieldValue} from './harness'

/** One text, registered for both keywords: a step that both sets up and acts. */
export function contextAndAction<A = undefined, B = undefined>(
  text: string,
  callback: StepDefinitionCallback<L10nContext, A, B>,
): StepDefinition<L10nContext, A, B>[] {
  return [Given<L10nContext, A, B>(text, callback), When<L10nContext, A, B>(text, callback)]
}

function localeList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

async function instance(context: L10nContext): Promise<WorkflowInstance> {
  return context.harness.engine.getInstance({instanceId: context.instanceId})
}

/** The children still awaiting their translation — i.e. the open cohort. */
async function pendingCohort(context: L10nContext): Promise<WorkflowInstance[]> {
  const children = await context.harness.engine.children({instanceId: context.instanceId})
  const open: WorkflowInstance[] = []
  for (const child of children) {
    const pending = await context.harness.pendingEffects(child._id)
    if (pending.some((effect) => effect.name === TRANSLATE_LOCALE)) open.push(child)
  }
  return open
}

/** Journey-agnostic: delivering events, reading stages, and the review decision. */
export const runSteps = [
  ...contextAndAction<undefined>('the publish event is delivered', async (context) => {
    context.agentCallsBefore = context.harness.agent.calls.length
    await deliverPublish(context.harness, context.subject)
    const run = await context.harness.runFor(context.subject._id)
    context.instanceId = run._id
  }),

  Then<L10nContext, string>('the run is in the {string} stage', async (context, stage) => {
    expect((await instance(context)).currentStage).toBe(stage)
  }),

  Then<L10nContext, string>(
    'the run reads the {string} perspective',
    async (context, perspective) => {
      expect((await instance(context)).perspective).toBe(perspective)
    },
  ),

  Then<L10nContext, string>('the {string} effect is pending', async (context, name) => {
    const pending = await context.harness.pendingEffects(context.instanceId)
    expect(pending.map((effect) => effect.name)).toEqual([name])
  }),

  Then<L10nContext>('the run has no locale children', async (context) => {
    expect(await context.harness.engine.children({instanceId: context.instanceId})).toHaveLength(0)
  }),

  Then<L10nContext, number, string>(
    'the run has {int} locale children for {string}',
    async (context, count, locales) => {
      const children = await context.harness.engine.children({instanceId: context.instanceId})
      expect(children).toHaveLength(count)
      expect(children.map(localeOf)).toEqual(localeList(locales))
    },
  ),

  Then<L10nContext, number, string>(
    'exactly {int} locale child is awaiting translation, for {string}',
    async (context, count, locales) => {
      const open = await pendingCohort(context)
      expect(open).toHaveLength(count)
      expect(open.map(localeOf)).toEqual(localeList(locales))
    },
  ),

  Then<L10nContext, string>(
    'the awaiting locale child carries the revision note {string}',
    async (context, note) => {
      const [child] = await pendingCohort(context)
      expect(child).toBeDefined()
      expect(fieldValue(child, 'revisionNote')).toBe(note)
    },
  ),

  Then<L10nContext>('no locale is flagged as failed', async (context) => {
    expect(fieldValue(await instance(context), 'hasFailedLocales')).toBeFalsy()
  }),

  Then<L10nContext>('the run is flagged as having a failed locale', async (context) => {
    expect(fieldValue(await instance(context), 'hasFailedLocales')).toBe(true)
  }),

  Then<L10nContext>('a publish guard holds the source', async (context) => {
    const guards = await context.harness.engine.guardsForInstance({
      instanceId: context.instanceId,
    })
    const holding = guards.filter(
      (guard) =>
        guard.match.actions.includes('publish') &&
        (guard.match.idRefs ?? []).includes(context.subject._id),
    )
    expect(holding.length).toBeGreaterThan(0)
  }),

  ...contextAndAction<undefined>('the source document is deleted', async (context) => {
    // The lake first, then the event — the same order the platform sees it. The
    // run's guard denies `publish`, not `delete`, so the editor gets this far.
    await context.harness.content.delete({
      query: '*[_id == $id || _id == $draft]',
      params: {id: context.subject._id, draft: `drafts.${context.subject._id}`},
    })
    await deliverDelete(context.harness, context.subject)
  }),

  Then<L10nContext, string>(
    'the run is aborted with the reason {string}',
    async (context, reason) => {
      const run = await instance(context)
      expect(run.completedAt, 'the run should be terminal').toBeDefined()
      expect(abortReason(run)).toBe(reason)
    },
  ),

  Then<L10nContext>('no guard holds the source', async (context) => {
    expect(
      await context.harness.engine.guardsForInstance({instanceId: context.instanceId}),
    ).toEqual([])
  }),

  ...contextAndAction<undefined>('the reviewer approves', async (context) => {
    await context.harness.engine.fireAction({
      instanceId: context.instanceId,
      activity: 'review',
      action: 'approve',
    })
  }),

  Then<L10nContext>('the approval records the reviewer', async (context) => {
    const approval = fieldValue(await instance(context), 'approval')
    expect(approval).toMatchObject({id: expect.any(String)})
  }),

  ...contextAndAction<string, string>(
    'the reviewer requests changes to {string} with the note {string}',
    async (context, locales, note) => {
      await context.harness.engine.fireAction({
        instanceId: context.instanceId,
        activity: 'review',
        action: 'request-changes',
        params: {
          note,
          locales: localeList(locales).map((locale) => ({locale, reason: 'reviewer'})),
        },
      })
    },
  ),
]

/**
 * Mode P: the harness reports what a handler would have reported. Shared by the
 * three document-tier journeys, which are about the definition's flow rather
 * than about what the handlers write.
 */
export const modePSteps = [
  ...contextAndAction<string>(
    'the analysis reports a material change to {string}',
    async (context, locales) => {
      await reportAnalysis(context.harness, context.instanceId, {
        materiality: 'material',
        locales: localeList(locales).map((locale) => ({locale, reason: 'body changed'})),
      })
    },
  ),

  ...contextAndAction<undefined>(
    'the analysis reports a cosmetic change affecting no locales',
    async (context) => {
      await reportAnalysis(context.harness, context.instanceId, {
        materiality: 'cosmetic',
        locales: [],
      })
    },
  ),

  ...contextAndAction<string>(
    'the {string} locale translation succeeds',
    async (context, locale) => {
      await settleLocale(context.harness, context.instanceId, locale, 'done')
    },
  ),

  ...contextAndAction<string>('the {string} locale translation fails', async (context, locale) => {
    await settleLocale(context.harness, context.instanceId, locale, 'failed')
  }),

  ...contextAndAction<undefined>('every remaining locale translation succeeds', async (context) => {
    await settleLocales(context.harness, context.instanceId, 'done')
  }),

  Then<L10nContext, string, string>(
    'the {string} child is in the {string} stage',
    async (context, locale, stage) => {
      const children = await context.harness.engine.children({instanceId: context.instanceId})
      const child = children.find((entry) => localeOf(entry) === locale)
      expect(child, `no child for ${locale}`).toBeDefined()
      expect(child?.currentStage).toBe(stage)
    },
  ),
]
