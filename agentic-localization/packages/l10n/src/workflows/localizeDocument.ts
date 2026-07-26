import {
  defineAction,
  defineActivity,
  defineField,
  defineGuard,
  defineStage,
  defineTransition,
  defineWorkflow,
} from '@sanity/workflow-engine/define'

import {SOURCE_LANGUAGE} from './config'
import {ANALYZE_SOURCE} from './effects'
import {localizeLocale} from './localizeLocale'
import {type LocalizeDocumentStage} from './stages'

/**
 * `defineStage` widens `name` to `string`. Declaring every stage through this
 * instead keeps the definition and `LocalizeDocumentStage` one vocabulary.
 */
function defineLocalizeDocumentStage(
  stage: Parameters<typeof defineStage>[0] & {name: LocalizeDocumentStage},
): ReturnType<typeof defineStage> {
  return defineStage(stage)
}

/**
 * One source document across every locale that needs work.
 *
 * Deliberately NOT `lifecycle: 'child'`: an editor starts this directly for the
 * document they have open, and a campaign spawns the same definition for each of
 * its documents.
 *
 * Autonomy lives in the `analyzing` stage rather than in configuration. The
 * analysis effect decides which locales a source edit actually affects; a
 * cosmetic edit yields no locales and the run completes without ever involving a
 * person, while a material one fans out and comes back for review.
 */
export const localizeDocument = defineWorkflow({
  name: 'localize-document',
  title: 'Localize a document',
  description: 'Analyzes a source document, translates the locales that need work, then reviews.',
  initialStage: 'analyzing' satisfies LocalizeDocumentStage,
  // The cohort gate, named once. It reads the open stage visit only, so a
  // re-entered stage waits on its own fresh children rather than the settled
  // ones from a previous pass. The non-empty clause keeps it correct if the
  // spawning action ever becomes caller-fired: an empty cohort counts as
  // settled and would otherwise resolve the activity before anything spawns.
  predicates: {
    localesSettled:
      `count($subworkflows[activity == 'translate' && current]) > 0 && ` +
      `count($subworkflows[activity == 'translate' && current && status == 'active']) == 0`,
  },
  start: {
    // A person starts this from the document they have open; a publish Function
    // also starts it unattended. `interactive` is the honest default for how a
    // run normally begins, and it only classifies — it gates nothing.
    kind: 'interactive',
    // Discovery, not permission. Without it the Studio picker would offer
    // "localize" on a fr-FR article, which is a translation, not a source.
    // Field-level types such as `person` carry no language field and stay
    // offerable.
    filter: `!defined(language) || language == "${SOURCE_LANGUAGE}"`,
    requirements: [
      {
        type: 'singleSubject',
        name: 'one-open-localization',
        title: 'Localization already in progress',
        description: 'Finish or abort the existing run before starting another for this document.',
      },
    ],
  },
  fields: [
    defineField({
      type: 'subject',
      name: 'subject',
      title: 'Source document',
      // Both localization tiers run through this definition: `article` is
      // document-level (one document per locale), `person` is field-level
      // (locales live in internationalized arrays on the one document).
      types: ['article', 'person'],
      initialValue: {type: 'input'},
      required: true,
    }),
    // Supplied by a campaign. Absent for a standalone run, which writes drafts.
    defineField({
      type: 'release.ref',
      name: 'release',
      title: 'Target release',
      initialValue: {type: 'input'},
    }),
    // Both written by the analysis effect's completion, at workflow scope so the
    // fan-out below can read them (spawn forEach sees workflow scope only).
    defineField({
      type: 'string',
      name: 'materiality',
      title: 'Change materiality',
      options: {
        list: [
          {title: 'Cosmetic', value: 'cosmetic'},
          {title: 'Minor', value: 'minor'},
          {title: 'Material', value: 'material'},
        ],
      },
    }),
    defineField({
      type: 'array',
      name: 'targetLocales',
      title: 'Locales needing work',
      of: [
        {type: 'string', name: 'locale'},
        {type: 'string', name: 'reason'},
      ],
    }),
    // The analysis in the reviewer's own language: why these locales, why this
    // materiality. Prose for a person to read — nothing branches on it, so it
    // carries no closed list and no validation beyond being text.
    defineField({type: 'text', name: 'explanation', title: 'Why this verdict'}),
    // The source revision the analysis ran against. Kept so a later edit to the
    // source can be detected while this run is still open.
    defineField({type: 'string', name: 'analyzedRev', title: 'Analyzed revision'}),
    // Set when the source moves under an open run. Advisory: it tells the
    // reviewer the translations no longer match the English they were derived
    // from, and never re-routes the run on its own.
    defineField({type: 'boolean', name: 'sourceChanged', title: 'Source changed since analysis'}),
    // A narrowed re-run requested by a reviewer. Empty means "all of them".
    defineField({
      type: 'array',
      name: 'retranslateLocales',
      title: 'Locales to redo',
      of: [
        {type: 'string', name: 'locale'},
        {type: 'string', name: 'reason'},
      ],
    }),
    // Set while still inside `translating`, where `current` scopes $subworkflows
    // to that visit's cohort. Read in review so the reviewer knows some markets
    // did not translate; advisory, like sourceChanged, rather than a hard gate.
    defineField({type: 'boolean', name: 'hasFailedLocales', title: 'A locale failed'}),
    defineField({type: 'actor', name: 'approval', title: 'Approved by'}),
    defineField({type: 'text', name: 'changeNote', title: 'Requested changes'}),
  ],
  stages: [
    defineLocalizeDocumentStage({
      name: 'analyzing',
      title: 'Analyzing the source',
      activities: [
        defineActivity({
          name: 'analyze',
          title: 'Work out what changed',
          actions: [
            // Entering `analyzing` is always a clean slate: a fresh analysis
            // supersedes both a stale source warning and any narrowed re-run a
            // reviewer asked for on a previous pass.
            defineAction({
              name: 'reset',
              title: 'Clear the previous pass',
              when: 'true',
              ops: [
                {type: 'field.unset', target: {field: 'sourceChanged'}},
                {type: 'field.unset', target: {field: 'retranslateLocales'}},
              ],
            }),
            defineAction({
              name: 'run',
              title: 'Analyze the source',
              when: 'true',
              effects: [{name: ANALYZE_SOURCE, bindings: {subject: '$fields.subject._id'}}],
            }),
            defineAction({
              name: 'analyzed',
              title: 'Analysis complete',
              when: `$effectStatus['${ANALYZE_SOURCE}'] == 'done'`,
              status: 'done',
            }),
            defineAction({
              name: 'analysis-failed',
              title: 'Analysis failed',
              when: `$effectStatus['${ANALYZE_SOURCE}'] == 'failed'`,
              status: 'failed',
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({
          name: 'to-failed',
          title: 'Analysis failed',
          to: 'failed',
          when: '$anyActivityFailed',
        }),
        // The autonomous path: nothing worth retranslating, so finish without a
        // human. coalesce guards the case where the effect wrote no locales at all.
        defineTransition({
          name: 'nothing-to-do',
          title: 'Nothing needs translating',
          to: 'done',
          when: '$allActivitiesDone && count(coalesce($fields.targetLocales, [])) == 0',
        }),
        defineTransition({
          name: 'to-translating',
          title: 'Locales need work',
          to: 'translating',
          when: '$allActivitiesDone',
        }),
      ],
    }),
    defineLocalizeDocumentStage({
      name: 'translating',
      title: 'Translating',
      // The field tier makes this gate load-bearing: its locale children write
      // their entries into the subject itself, so a publish mid-fan-out ships a
      // document that is translated into some markets and not others. Same
      // shape as the review gate — `publish` only, so the source can still be
      // edited — and it holds document-tier sources for the same window, which
      // is a few seconds of an already-machine-only stage.
      guards: [
        defineGuard({
          name: 'hold-source-publish-during-translation',
          title: 'Localization in progress',
          match: {idRefs: [{type: 'fieldRead', field: 'subject'}], actions: ['publish']},
        }),
      ],
      activities: [
        defineActivity({
          name: 'translate',
          title: 'Translate every locale that needs work',
          actions: [
            // Each visit reassesses from scratch, so a locale that failed once
            // and succeeded on retry does not stay flagged.
            defineAction({
              name: 'reset-failures',
              title: 'Clear the previous cohort verdict',
              when: 'true',
              ops: [{type: 'field.unset', target: {field: 'hasFailedLocales'}}],
            }),
            defineAction({
              name: 'fan-out',
              title: 'Start a run per locale',
              when: 'true',
              spawn: {
                // A reviewer who asked to redo only some locales narrows the
                // cohort; otherwise every locale the analysis flagged runs.
                // Rows also need a stable identity or the engine cannot tell
                // "same row" from "new row" when the stage is re-entered — the
                // locale is the natural key: one run per locale, per visit.
                forEach:
                  'select(count(coalesce($fields.retranslateLocales, [])) > 0 ' +
                  '=> $fields.retranslateLocales, $fields.targetLocales)' +
                  '[]{"_key": locale, locale, reason}',
                definition: {name: localizeLocale.name},
                with: {
                  locale: '$row.locale',
                  // A doc.ref read resolves to the referenced document, so the
                  // {id, type} pair has to be rebuilt rather than passed through.
                  source: '{"id": $fields.subject._id, "type": $fields.subject._type}',
                  release: '$fields.release',
                  revisionNote: '$fields.changeNote',
                },
              },
            }),
            // Cohort `status` means settled, not succeeded: a child that ended in
            // its own `failed` stage still reports 'done'. Success lives in the
            // row's `stage`, and this has to be read here rather than in review —
            // once the stage is exited `current` is false for every row and the
            // cohorts of earlier visits become indistinguishable from this one.
            defineAction({
              name: 'note-failed-locales',
              title: 'Record that a locale failed',
              when: `count($subworkflows[activity == 'translate' && current && stage == 'failed']) > 0`,
              ops: [
                {
                  type: 'field.set',
                  target: {field: 'hasFailedLocales'},
                  value: {type: 'literal', value: true},
                },
              ],
            }),
            defineAction({
              name: 'all-translated',
              title: 'Every locale settled',
              when: '$localesSettled',
              status: 'done',
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({
          name: 'to-review',
          title: 'Ready for review',
          to: 'review',
          when: '$allActivitiesDone',
        }),
      ],
    }),
    defineLocalizeDocumentStage({
      name: 'review',
      title: 'Review',
      // `publish` only, deliberately. Denying `update` would block the source edit
      // that `source-changed` exists to surface, and this workflow's position is
      // that drift is reported to the reviewer rather than prevented.
      //
      // Known limit: a guard's idRefs resolves to exactly one document, so the
      // parent cannot also hold the translated documents — they live in child runs
      // that are terminal before this stage is entered.
      guards: [
        defineGuard({
          name: 'hold-source-publish-during-review',
          title: 'Localization under review',
          match: {idRefs: [{type: 'fieldRead', field: 'subject'}], actions: ['publish']},
        }),
      ],
      // Stage-scoped, so it resets on every visit and a previous decision cannot
      // re-fire a transition when the stage is re-entered after changes.
      fields: [defineField({type: 'string', name: 'decision', title: 'Review decision'})],
      activities: [
        defineActivity({
          name: 'review',
          title: 'Review every locale',
          actions: [
            // Notices that the English moved while this run was open and says so.
            // It deliberately does not re-route: the reviewer decides whether the
            // drift matters, the same way a code review surfaces new commits
            // rather than discarding the review. Needs something to tick the
            // instance — a publish Function on the source — to be observed.
            defineAction({
              name: 'source-changed',
              title: 'Source changed since analysis',
              when: `defined($fields.analyzedRev) && $fields.subject._rev != $fields.analyzedRev`,
              ops: [
                {
                  type: 'field.set',
                  target: {field: 'sourceChanged'},
                  value: {type: 'literal', value: true},
                },
              ],
            }),
            defineAction({
              name: 'approve',
              title: 'Approve',
              semantics: ['decision.accept'],
              status: 'done',
              ops: [
                {
                  type: 'field.set',
                  target: {field: 'decision'},
                  value: {type: 'literal', value: 'approve'},
                },
                {type: 'field.set', target: {field: 'approval'}, value: {type: 'actor'}},
              ],
            }),
            defineAction({
              name: 'request-changes',
              title: 'Request changes',
              description: 'Redo exactly the named locales, leaving the rest as approved.',
              semantics: ['decision.decline'],
              status: 'done',
              params: [
                {type: 'string', name: 'note', title: 'What to change', required: true},
                // Required rather than optional-with-a-default: params carry no
                // defaults, and writing an absent one into an array field is a
                // shape error. An explicit list also beats an empty-means-all
                // convention — the surface offering this action is already
                // displaying the locales, so it always knows them.
                // Rows are shaped like targetLocales so the fan-out projection
                // reads either array the same way.
                {type: 'json', name: 'locales', title: 'Locales to redo', required: true},
              ],
              ops: [
                {
                  type: 'field.set',
                  target: {field: 'decision'},
                  value: {type: 'literal', value: 'request-changes'},
                },
                {
                  type: 'field.set',
                  target: {field: 'changeNote'},
                  value: {type: 'param', param: 'note'},
                },
                {
                  type: 'field.set',
                  target: {field: 'retranslateLocales'},
                  value: {type: 'param', param: 'locales'},
                },
              ],
            }),
            // The other half of the source-drift story. Requesting changes trusts
            // what the reviewer just told us; this one says "the source moved,
            // work out what that means again" and is the only path that spends
            // another analysis call.
            defineAction({
              name: 'refresh-from-source',
              title: 'Re-analyze the source',
              status: 'done',
              ops: [
                {
                  type: 'field.set',
                  target: {field: 'decision'},
                  value: {type: 'literal', value: 'refresh'},
                },
              ],
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({
          name: 'to-approved',
          title: 'Approved',
          to: 'approved',
          when: `$allActivitiesDone && $fields.decision == 'approve'`,
        }),
        defineTransition({
          name: 'back-to-translating',
          title: 'Changes requested',
          to: 'translating',
          when: `$allActivitiesDone && $fields.decision == 'request-changes'`,
        }),
        defineTransition({
          name: 'back-to-analyzing',
          title: 'Fresh analysis requested',
          to: 'analyzing',
          when: `$allActivitiesDone && $fields.decision == 'refresh'`,
        }),
      ],
    }),
    defineLocalizeDocumentStage({name: 'approved', title: 'Approved'}),
    // Reached when the source change did not warrant any retranslation.
    defineLocalizeDocumentStage({name: 'done', title: 'No work needed'}),
    defineLocalizeDocumentStage({name: 'failed', title: 'Failed'}),
  ],
})
