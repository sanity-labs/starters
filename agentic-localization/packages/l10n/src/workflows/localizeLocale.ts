import {
  defineAction,
  defineActivity,
  defineField,
  defineStage,
  defineTransition,
  defineWorkflow,
} from '@sanity/workflow-engine/define'

import {TRANSLATE_LOCALE} from './effects'

/**
 * One target locale of one source document. Machine-only: the parent holds the
 * single human review pass over every locale, so this child never waits on a
 * caller and settles as soon as its translation lands or fails.
 *
 * `lifecycle: 'child'` makes it spawn-only — it cannot be started on its own.
 */
export const localizeLocale = defineWorkflow({
  name: 'localize-locale',
  title: 'Localize a locale',
  description: 'Translates one source document into one target locale.',
  lifecycle: 'child',
  initialStage: 'translating',
  fields: [
    defineField({
      type: 'string',
      name: 'locale',
      title: 'Target locale',
      initialValue: {type: 'input'},
      required: true,
    }),
    // The source document. A subject would imply this child is what a Studio
    // picker attaches to; it is not — the parent owns that relationship.
    defineField({
      type: 'doc.ref',
      name: 'source',
      title: 'Source document',
      initialValue: {type: 'input'},
      required: true,
    }),
    // Present when the run belongs to a campaign: the handler writes a version
    // into this release instead of a draft.
    defineField({
      type: 'release.ref',
      name: 'release',
      title: 'Target release',
      initialValue: {type: 'input'},
    }),
    // Carried down from a parent review that asked for changes, so a re-run can
    // feed the reviewer's note back into the translation prompt.
    defineField({
      type: 'text',
      name: 'revisionNote',
      title: 'Revision note',
      initialValue: {type: 'input'},
    }),
    // Written by the effect once the translated document exists.
    defineField({type: 'doc.ref', name: 'target', title: 'Translated document'}),
    // Captured at translate-completion because that is the only moment machine
    // output is unambiguous — the next writer is the reviewer.
    defineField({type: 'string', name: 'machineRev', title: 'Machine draft revision'}),
    defineField({type: 'progress', name: 'translationProgress', title: 'Translation progress'}),
  ],
  stages: [
    defineStage({
      name: 'translating',
      title: 'Translating',
      activities: [
        defineActivity({
          name: 'translate',
          title: 'Translate into the target locale',
          actions: [
            defineAction({
              name: 'run',
              title: 'Run the translation',
              when: 'true',
              effects: [
                {
                  name: TRANSLATE_LOCALE,
                  bindings: {
                    source: '$fields.source._id',
                    locale: '$fields.locale',
                    release: '$fields.release',
                    revisionNote: '$fields.revisionNote',
                  },
                },
              ],
            }),
            defineAction({
              name: 'translated',
              title: 'Translation ready',
              when: `$effectStatus['${TRANSLATE_LOCALE}'] == 'done'`,
              status: 'done',
            }),
            defineAction({
              name: 'translation-failed',
              title: 'Translation failed',
              when: `$effectStatus['${TRANSLATE_LOCALE}'] == 'failed'`,
              status: 'failed',
            }),
          ],
        }),
      ],
      transitions: [
        // Failure has to reach a terminal stage rather than park in place. A child
        // that stays in-flight still counts as 'active' in its parent's cohort, so
        // parking here would hang the whole document run on one bad locale. Ending
        // in `failed` settles the slot and lets the reviewer see a partial result.
        //
        // A failed activity is neither done nor skipped, so $allActivitiesDone stays
        // false and cannot race this edge; it is declared first regardless, so the
        // failure route is explicit rather than inferred from ordering.
        defineTransition({name: 'to-failed', to: 'failed', when: '$anyActivityFailed'}),
        defineTransition({name: 'to-translated', to: 'translated', when: '$allActivitiesDone'}),
      ],
    }),
    defineStage({name: 'translated', title: 'Translated'}),
    defineStage({name: 'failed', title: 'Failed'}),
  ],
})
