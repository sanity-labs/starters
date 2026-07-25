/**
 * J7 — the learning loop, mode H: the real effect handlers AND the real
 * `distill-review` Function, with only the Agent Actions canned.
 *
 * Field tier, deliberately: the canned translate answer is the in-place shape, so
 * `person` is the journey where the write paths this loop reads back are real.
 */

import type {L10nContext} from '../fixtures/context'

import {distillationTypeName, localeTypeName, proposalTypeName} from '@starter/l10n'
import {claimId} from '@starter/l10n/distill'
import {After, Before, Given, Then} from 'racejar'
import {Feature} from 'racejar/vitest'
import {afterAll, beforeAll, expect} from 'vitest'

import {clearTypes, publishPerson, seedLocales} from '../fixtures/content'
import {resetContext} from '../fixtures/context'
import {deliverApproved} from '../fixtures/events'
import {createHarness} from '../fixtures/harness'
import {contextAndAction, runSteps} from '../fixtures/steps'
import featureText from './distill-review.feature?raw'

const harness = createHarness('H')

const BIO = 'Ada Lovelace wrote the first algorithm intended for a machine.'

/**
 * The types this journey reads by TYPE rather than by id. Proposals and claim
 * documents are keyed by content hash and instance hash, so they carry no run
 * prefix for the harness's own sweep to find.
 */
const OWNED_TYPES = [localeTypeName, distillationTypeName, proposalTypeName, 'person']

/** The `prompt` calls spent since the scenario's publish event. */
function promptsSince(context: L10nContext) {
  return context.harness.agent.calls
    .slice(context.agentCallsBefore ?? 0)
    .filter((call) => call.action === 'prompt')
}

/** Every proposal draft in the dataset, newest first. */
async function proposals(context: L10nContext): Promise<Record<string, unknown>[]> {
  return context.harness.content.fetch<Record<string, unknown>[]>(
    `*[_type == $type] | order(_createdAt desc)`,
    {type: proposalTypeName},
    {perspective: 'raw'},
  )
}

beforeAll(() => harness.deploy())
afterAll(async () => {
  await clearTypes(harness.content, OWNED_TYPES)
  await harness.dispose()
})

Feature<L10nContext>({
  featureText,
  hooks: [
    Before<L10nContext>((context) => {
      resetContext(context)
      context.harness = harness
    }),
    After<L10nContext>(() => harness.resetScenario()),
  ],
  stepDefinitions: [
    Given<L10nContext, string>('the locales {string}', async (context, codes) => {
      // Cleared by type: a previous scenario's proposals and claim documents would
      // otherwise satisfy this one's assertions.
      await clearTypes(context.harness.content, OWNED_TYPES)
      await seedLocales(
        context.harness.content,
        codes.split(',').map((code) => code.trim()),
      )
    }),

    Given<L10nContext>('a published profile', async (context) => {
      context.subject = await publishPerson(context.harness, {
        name: 'Ada Lovelace',
        bio: BIO,
        metaTitle: 'Ada Lovelace',
        metaDescription: 'The first programmer.',
      })
    }),

    ...contextAndAction<undefined>('the effect handlers drain the run', async (context) => {
      await context.harness.drainRun(context.instanceId)
    }),

    /**
     * A targeted correction, not a rewrite: the gate classifies a wholesale
     * rewrite as style-only and extracts no terminology from it, so a journey
     * about a glossary term has to look like a glossary term being fixed.
     */
    Given<L10nContext, string>(
      'the reviewer corrects two words in the {string} bio',
      async (context, locale) => {
        const draftId = `drafts.${context.subject._id}`
        const draft = await context.harness.content.fetch<null | Record<string, unknown>>(
          '*[_id == $id][0]',
          {id: draftId},
          {perspective: 'raw'},
        )
        const entries = Array.isArray(draft?.bio) ? draft.bio : []
        const machine = entries.find(
          (row): row is {language: string; value: string} =>
            typeof row === 'object' &&
            row !== null &&
            'language' in row &&
            row.language === locale &&
            typeof (row as {value?: unknown}).value === 'string',
        )
        expect(machine, `the handlers should have written a ${locale} bio`).toBeDefined()

        const corrected = machine!.value
          .replace('algorithm', 'Algorithmus')
          .replace('machine', 'Maschine')
        expect(corrected).not.toBe(machine!.value)

        await context.harness.content
          .patch(draftId)
          .set({[`bio[language=="${locale}"].value`]: corrected})
          .commit({tag: 'reviewer-edit'})
      },
    ),

    ...contextAndAction<undefined>('the approved run is distilled', async (context) => {
      await deliverApproved(context.harness, context.instanceId)
    }),

    Then<L10nContext, string, string>(
      'a draft {string} proposal exists for {string}',
      async (context, kind, locale) => {
        const rows = await proposals(context)
        const matching = rows.filter((row) => row.kind === kind && row.locale === locale)
        expect(matching, `no ${kind} proposal for ${locale}`).toHaveLength(1)
        // Draft only: prompt assembly reads published, approved-status context, so
        // nothing the loop writes can reach a prompt without two human acts.
        expect(String(matching[0]._id)).toMatch(/^drafts\.l10n\.proposal\./)
        expect(matching[0].occurrences).toBe(1)
      },
    ),

    Then<L10nContext>(
      'the proposal quotes the machine text beside the text that was approved',
      async (context) => {
        const [proposal] = (await proposals(context)).filter((row) => row.kind === 'glossary-term')
        expect(proposal).toBeDefined()
        expect(proposal).toMatchObject({
          term: 'algorithm',
          translation: 'Algorithmus',
          run: context.instanceId,
          subject: {_ref: context.subject._id, _weak: true},
        })
        expect(proposal.evidence).toMatchObject({
          fieldPath: 'bio',
          sourceExcerpt: BIO,
          machineText: expect.stringContaining('algorithm'),
          humanText: expect.stringContaining('Algorithmus'),
        })
      },
    ),

    Then<L10nContext>('the eval case records the revision the machine wrote', async (context) => {
      const [evalCase] = (await proposals(context)).filter((row) => row.kind === 'eval-case')
      expect(evalCase?.coordinates).toMatchObject({
        locale: 'de-DE',
        targetId: `drafts.${context.subject._id}`,
        targetRev: expect.any(String),
        sourceRev: expect.any(String),
      })
    }),

    Then<L10nContext, number, number>(
      'the distillation record reports {int} proposal from {int} AI call',
      async (context, proposalCount, aiSpent) => {
        const claim = await context.harness.content.fetch<null | Record<string, unknown>>(
          '*[_id == $id][0]',
          {id: claimId(context.instanceId)},
          {perspective: 'raw'},
        )
        expect(claim, 'the claim document is the audit record').not.toBeNull()
        expect(claim).toMatchObject({
          run: context.instanceId,
          status: 'done',
          proposals: proposalCount,
          aiSpent,
          locales: ['de-DE'],
        })
      },
    ),

    Then<L10nContext, number, number>(
      'the distillation record reports {int} proposal from {int} AI calls',
      async (context, proposalCount, aiSpent) => {
        const claim = await context.harness.content.fetch<null | Record<string, unknown>>(
          '*[_id == $id][0]',
          {id: claimId(context.instanceId)},
          {perspective: 'raw'},
        )
        expect(claim).toMatchObject({proposals: proposalCount, aiSpent, status: 'done'})
      },
    ),

    Then<L10nContext, number>('exactly {int} proposal exists', async (context, count) => {
      expect(await proposals(context)).toHaveLength(count)
    }),

    /**
     * Counted as `prompt` calls only, from the publish event onwards. The
     * translate calls the fan-out spends are not the loop's, and a first-publish
     * analysis reaches no prompt at all (`content.ts` explains why), so every
     * prompt in the window belongs to a distillation.
     */
    Then<L10nContext, number>('exactly {int} AI call was spent in total', (context, count) => {
      expect(promptsSince(context)).toHaveLength(count)
    }),

    Then<L10nContext>('no AI call was spent on the distillation', (context) => {
      expect(promptsSince(context)).toEqual([])
    }),

    ...runSteps,
  ],
})
