/**
 * J6 — the field tier, mode H: the real effect handlers with canned Agent
 * Actions. What lands in the lake, and what deliberately does not.
 */

import type {L10nContext} from '../fixtures/context'

import {entryFor, internationalizedFields, localeTypeName} from '@starter/l10n'
import {After, Before, Given, Then, When} from 'racejar'
import {Feature} from 'racejar/vitest'
import {afterAll, beforeAll, expect} from 'vitest'

import {clearTypes, publish, publishPerson, seedLocales} from '../fixtures/content'
import {resetContext} from '../fixtures/context'
import {deliverPublish} from '../fixtures/events'
import {createHarness, fieldValue} from '../fixtures/harness'
import {contextAndAction, runSteps} from '../fixtures/steps'
import featureText from './field-tier-person.feature?raw'

const harness = createHarness('H')

const BIO = 'Ada Lovelace wrote the first algorithm intended for a machine.'

/**
 * The types this journey reads by TYPE rather than by id — the candidate locale
 * set, and the two "no document was created" assertions. Emptied before each
 * scenario so a previous run's litter cannot pass or fail them.
 */
const OWNED_TYPES = [localeTypeName, 'person', 'translation.metadata']

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
      // The analysis handler derives its candidate set from every `l10n.locale`
      // in the dataset, so the set has to be exactly what the scenario declares.
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

    Given<L10nContext>('a published profile with no source content', async (context) => {
      context.subject = await publishPerson(context.harness, {name: 'Grace Hopper'})
    }),

    ...contextAndAction<undefined>('the effect handlers drain the run', async (context) => {
      await context.harness.drainRun(context.instanceId)
    }),

    When<L10nContext>('the analysis alone drains', async (context) => {
      await context.harness.drain(context.instanceId)
    }),

    When<L10nContext>('the profile is republished', async (context) => {
      context.agentCallsBefore = context.harness.agent.calls.length
      context.subject = await publish(context.harness, context.subject._id)
      await deliverPublish(context.harness, context.subject)
      const runs = await context.harness.runsFor(context.subject._id)
      expect(runs.length, 'the republish should open a fresh run').toBeGreaterThan(1)
      context.instanceId = runs[runs.length - 1]._id
    }),

    Then<L10nContext>('no AI call was spent', (context) => {
      const spent = context.harness.agent.calls
        .slice(context.agentCallsBefore)
        .map((call) => call.action)
      expect(spent).toEqual([])
    }),

    Then<L10nContext, string>(
      'the profile draft carries {string} values for every internationalized field',
      async (context, locale) => {
        const draft = await context.harness.content.fetch<null | Record<string, unknown>>(
          '*[_id == $id][0]',
          {id: `drafts.${context.subject._id}`},
          {perspective: 'raw'},
        )
        expect(draft, 'the handlers should have written a draft').not.toBeNull()

        for (const field of internationalizedFields('person')) {
          const entry = entryFor(draft ?? {}, field, locale)
          expect(entry?.value, `${field.path} has no ${locale} entry`).toEqual(
            expect.stringContaining(`[${locale}]`),
          )
        }
      },
    ),

    Then<L10nContext>('no second profile document was created', async (context) => {
      const ids = await context.harness.content.fetch<string[]>(
        '*[_type == "person"]._id',
        {},
        {perspective: 'raw'},
      )
      expect([...ids].sort()).toEqual([context.subject._id, `drafts.${context.subject._id}`].sort())
    }),

    Then<L10nContext>('no translation.metadata document was created', async (context) => {
      const count = await context.harness.content.fetch<number>(
        'count(*[_type == "translation.metadata"])',
        {},
        {perspective: 'raw'},
      )
      expect(count).toBe(0)
    }),

    Then<L10nContext>('every locale child recorded the revision it wrote', async (context) => {
      const children = await context.harness.engine.children({instanceId: context.instanceId})
      expect(children.length).toBeGreaterThan(0)
      for (const child of children) {
        expect(fieldValue(child, 'machineRev')).toEqual(expect.any(String))
        expect(fieldValue(child, 'target')).toMatchObject({type: 'person'})
      }
    }),

    ...runSteps,
  ],
})
