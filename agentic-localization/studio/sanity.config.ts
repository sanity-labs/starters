import {createClient} from '@sanity/client'
import {defineConfig} from 'sanity'
import {structureTool, type StructureResolver} from 'sanity/structure'
import {assist} from '@sanity/assist'
import {visionTool} from '@sanity/vision'
import {EarthGlobeIcon} from '@sanity/icons'
import {workflowDefaultDocumentNode, workflowStudioPlugin} from '@sanity/workflow-studio-plugin'
import {fieldTierTypes} from '@starter/l10n'
import {
  createL10n,
  createLocalizationScheduleGate,
  LOCALIZE_DOCUMENT_DEFINITION,
  withLocaleFilter,
  withRunSections,
} from '@starter/l10n-studio'
import {SOURCE_LANGUAGE, WORKFLOW_TAG, WORKFLOWS_DATASET} from '@starter/l10n/workflows'
import {schemaTypes} from './schemaTypes'

const l10nTypes = [
  'l10n.locale',
  'l10n.glossary',
  'l10n.styleGuide',
  // What the learning loop proposes, awaiting a reviewer's Accept or Reject.
  'l10n.proposal',
  'translation.metadata',
]

/** Types localized one document per locale. */
const documentTierTypes = ['article']

/** Every type `localize-document` runs against, both tiers. */
const localizationSubjectTypes = [...documentTierTypes, ...fieldTierTypes()]

const projectId = import.meta.env?.SANITY_STUDIO_PROJECT_ID ?? process.env.SANITY_STUDIO_PROJECT_ID!
const dataset = import.meta.env?.SANITY_STUDIO_DATASET ?? process.env.SANITY_STUDIO_DATASET!

const l10n = createL10n({localizedSchemaTypes: documentTierTypes, defaultLanguage: SOURCE_LANGUAGE})

const titleAsc = [{field: 'title', direction: 'asc'} as const]
const nameAsc = [{field: 'name', direction: 'asc'} as const]
const occurrencesDesc = [
  {field: 'occurrences', direction: 'desc'} as const,
  {field: '_createdAt', direction: 'desc'} as const,
]

const structure = ((S, {i18n}) =>
  S.list()
    .title('Content')
    .items([
      S.documentTypeListItem('article').child(() =>
        withLocaleFilter(S.documentTypeList('article').defaultOrdering(titleAsc)),
      ),
      S.divider(),
      S.documentTypeListItem('person').child(S.documentTypeList('person').defaultOrdering(nameAsc)),
      S.documentTypeListItem('editorialTopic').child(
        S.documentTypeList('editorialTopic').defaultOrdering(titleAsc),
      ),
      S.documentTypeListItem('tag').child(S.documentTypeList('tag').defaultOrdering(titleAsc)),
      S.divider(),
      // The inbox first — which runs need a person right now — then the
      // documents localization is configured from. `withRunSections` reads the
      // engine, so the whole list arrives as an observable and its counts stay
      // live.
      S.listItem()
        .title('Localization')
        .icon(EarthGlobeIcon)
        .child(() =>
          withRunSections(
            S,
            i18n,
            l10nTypes.map((type) =>
              S.documentTypeListItem(type).child(
                type === 'translation.metadata'
                  ? S.documentTypeList(type)
                  : // A proposal has no title; the count of times a correction
                    // has recurred is what a reviewer should triage by.
                    type === 'l10n.proposal'
                    ? S.documentTypeList(type).defaultOrdering(occurrencesDesc)
                    : S.documentTypeList(type).defaultOrdering(titleAsc),
              ),
            ),
          ),
        ),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (item) =>
          !['article', 'person', 'editorialTopic', 'tag', ...l10nTypes].includes(
            item.getId() ?? '',
          ),
      ),
    ])) satisfies StructureResolver

export default defineConfig({
  name: 'default',
  title: 'AI Launch: Agentic Localization',

  projectId,
  dataset,

  unstable_clientFactory: (options) =>
    createClient({...options, requestTagPrefix: `${options.requestTagPrefix}.agentic-l10n`}),

  document: {
    // Neither is hand-authored: a join document is written by the translation
    // plugin, a proposal by `distill-review`.
    newDocumentOptions: (prev) =>
      prev.filter(
        (option) => !['translation.metadata', 'l10n.proposal'].includes(option.templateId),
      ),
    actions: (prev, context) => {
      // The workflow plugin locks `publish`, `unpublish` and `delete` from the
      // run's own guard; `schedule` is outside its lock map, so it is wrapped
      // here. At the config root because the core injects `schedule` after
      // plugins run.
      if (!localizationSubjectTypes.includes(context.schemaType)) return prev
      return prev.map((action) =>
        action.action === 'schedule' ? createLocalizationScheduleGate(action) : action,
      )
    },
  },

  plugins: [
    structureTool({
      structure,
      // Every content document gets a Workflows view alongside its form; which
      // definitions apply is discovered at runtime from the deployed set.
      defaultDocumentNode: workflowDefaultDocumentNode(),
    }),
    visionTool(),
    // Engine state lives in its own dataset. The tag and dataset must match the
    // deployment in `sanity.workflow.ts` — a mismatch reads an empty partition.
    workflowStudioPlugin({
      tag: WORKFLOW_TAG,
      workflowDataset: WORKFLOWS_DATASET,
      // The plugin discovers `(docType, definition)` bindings from the deployed
      // definitions' subject types, so both rows exist without being named. They
      // are named anyway to label them and to mark where each tier's start
      // behavior is configured.
      //
      // `article` seeds the release the editor has selected, so a run started
      // from the picker writes versions into it rather than drafts. `person`
      // deliberately does not: its locale children patch the subject itself, so
      // a run scoped to a release would read the same version it writes and
      // report its own output as source drift. The perspective that avoids
      // that (`published`, see `startPerspectiveFor`) has no hook here — the
      // Start action only offers `perspectiveField` — so a field-tier run is
      // only fully correct when the publish Function or the dashboard starts
      // it. The inspector says so when it sees a run reading drafts.
      //
      // `perspectiveField` is also the only way to start from the picker at
      // all: the Start dialog demands every uncovered input entry of the
      // definition, `release` included, and covering it is what a selected
      // release does. Absent one — as on `person` — the dialog asks for a
      // release outright. Drafts-scoped runs start from the dashboard. See
      // "Localize from the Studio picker asks for a release" in
      // `skills/sanity-l10n/references/operating.md`.
      mappings: [
        {
          docType: 'article',
          definition: LOCALIZE_DOCUMENT_DEFINITION,
          label: 'Localize this article',
          perspectiveField: {name: 'release'},
        },
        {
          docType: 'person',
          definition: LOCALIZE_DOCUMENT_DEFINITION,
          label: 'Localize this profile',
        },
      ],
    }),
    l10n.plugin,
    // AI Assist stays for the generation and instruction affordances it gives
    // every field. Its translate field action is gone: it assembled context its
    // own way, bypassing `buildTranslateParams` and the review the run owns.
    assist(),
  ],

  schema: {
    types: l10n.injectLanguageField(schemaTypes),
  },
})
