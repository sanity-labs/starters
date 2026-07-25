import {
  defineAction,
  defineActivity,
  defineField,
  defineStage,
  defineTransition,
  defineWorkflow,
} from '@sanity/workflow-engine/define'

import {PUBLISH_RELEASE} from './effects'
import {localizeDocument} from './localizeDocument'

/**
 * A batch of documents localized together and shipped as one Content Release.
 * This is what the dashboard's batch action starts.
 *
 * The release is the batching mechanism: every locale writes a version into it,
 * and the campaign holds the go-live decision until each document has been
 * reviewed and approved.
 */
export const localizeCampaign = defineWorkflow({
  name: 'localize-campaign',
  title: 'Localization campaign',
  description: 'Localizes a set of documents and publishes them as one Content Release.',
  initialStage: 'assembly',
  predicates: {
    documentsSettled:
      `count($subworkflows[activity == 'localize' && current]) > 0 && ` +
      `count($subworkflows[activity == 'localize' && current && status == 'active']) == 0`,
  },
  // Always started by a person choosing a batch and a release; nothing starts a
  // campaign unattended.
  start: {kind: 'interactive'},
  fields: [
    // release.ref is input-only, so the release must already exist when the
    // campaign starts — the starting surface creates it and hands it over.
    defineField({
      type: 'release.ref',
      name: 'release',
      title: 'Content Release',
      initialValue: {type: 'input'},
      required: true,
    }),
    defineField({
      type: 'doc.refs',
      name: 'documents',
      title: 'Source documents',
      types: ['article', 'person'],
      initialValue: {type: 'input'},
      required: true,
    }),
    defineField({type: 'datetime', name: 'publishAt', title: 'Scheduled go-live'}),
  ],
  stages: [
    defineStage({
      name: 'assembly',
      title: 'Assembling',
      activities: [
        defineActivity({
          name: 'localize',
          title: 'Localize every document',
          actions: [
            defineAction({
              name: 'open-documents',
              title: 'Start a run per document',
              when: 'true',
              spawn: {
                forEach: '$fields.documents[]',
                definition: {name: localizeDocument.name},
                // Rows are already global document references, so they key
                // themselves and pass straight through as the child's subject.
                with: {subject: '$row', release: '$fields.release'},
              },
            }),
            defineAction({
              name: 'all-localized',
              title: 'Every document settled',
              when: '$documentsSettled',
              status: 'done',
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({
          name: 'to-ready',
          title: 'Every document settled',
          to: 'ready',
          when: '$allActivitiesDone',
        }),
      ],
    }),
    defineStage({
      name: 'ready',
      title: 'Ready to ship',
      fields: [defineField({type: 'string', name: 'decision', title: 'Go-live decision'})],
      activities: [
        defineActivity({
          name: 'go-live',
          title: 'Schedule or publish the release',
          actions: [
            defineAction({
              name: 'schedule',
              title: 'Schedule',
              status: 'done',
              params: [{type: 'dateTime', name: 'publishAt', title: 'Go live at', required: true}],
              ops: [
                {
                  type: 'field.set',
                  target: {field: 'publishAt'},
                  value: {type: 'param', param: 'publishAt'},
                },
                {
                  type: 'field.set',
                  target: {field: 'decision'},
                  value: {type: 'literal', value: 'schedule'},
                },
              ],
            }),
            defineAction({
              name: 'publish-now',
              title: 'Publish now',
              status: 'done',
              ops: [
                {
                  type: 'field.set',
                  target: {field: 'decision'},
                  value: {type: 'literal', value: 'publish-now'},
                },
              ],
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({
          name: 'to-publishing',
          title: 'Go-live decided',
          to: 'publishing',
          when: '$allActivitiesDone',
        }),
      ],
    }),
    defineStage({
      name: 'publishing',
      title: 'Publishing',
      activities: [
        defineActivity({
          name: 'publish',
          title: 'Ship the release',
          actions: [
            defineAction({
              name: 'run',
              title: 'Schedule or publish',
              when: 'true',
              effects: [
                {
                  name: PUBLISH_RELEASE,
                  bindings: {release: '$fields.release', publishAt: '$fields.publishAt'},
                },
              ],
            }),
            defineAction({
              name: 'shipped',
              title: 'Release shipped',
              when: `$effectStatus['${PUBLISH_RELEASE}'] == 'done'`,
              status: 'done',
            }),
            defineAction({
              name: 'publish-failed',
              title: 'Publishing failed',
              when: `$effectStatus['${PUBLISH_RELEASE}'] == 'failed'`,
              status: 'failed',
            }),
          ],
        }),
      ],
      transitions: [
        // A failed publish returns to the go-live decision rather than parking
        // here or dead-ending in a terminal stage. Both alternatives strand the
        // campaign: `run` is a trigger, and a trigger fires at most once per stage
        // visit, so neither resetActivity nor setStage back to this same stage
        // re-queues the effect. Re-entering `ready` and firing go-live again is a
        // fresh visit, which re-arms it. The edge cannot spin on its own because
        // leaving `ready` requires a caller.
        defineTransition({
          name: 'back-to-ready',
          title: 'Publishing failed',
          to: 'ready',
          when: '$anyActivityFailed',
        }),
        defineTransition({
          name: 'to-published',
          title: 'Release shipped',
          to: 'published',
          when: '$allActivitiesDone',
        }),
      ],
    }),
    defineStage({name: 'published', title: 'Published'}),
  ],
})
