import {defineField, defineType} from '@sanity/types'
import {SparklesIcon} from '@sanity/icons'
import {PROPOSAL_KINDS, proposalTypeName} from '@starter/l10n'

/**
 * What the learning loop learned from one approved run.
 *
 * Only ever exists as a DRAFT, written by `distill-review`. Every field is
 * read-only: a proposal is evidence, and a reviewer's verbs are Accept and
 * Reject, not "edit the machine's reasoning until it sounds right". Accepting
 * copies it into a glossary or a style guide — as a draft, with an explicit
 * `approved` status — and deletes the proposal.
 *
 * Deliberately NOT reachable from "Create new": nothing hand-authors one.
 *
 * A factory because `subject` references the localization subject types, which
 * belong to the project rather than to this package — `createL10n` knows them.
 */
export function proposal({subjectTypes}: {subjectTypes: readonly string[]}) {
  return defineType({
    name: proposalTypeName,
    title: 'Localization Proposal',
    type: 'document',
    icon: SparklesIcon,
    readOnly: true,
    fields: [
      defineField({
        name: 'kind',
        title: 'Kind',
        type: 'string',
        options: {list: PROPOSAL_KINDS.map((value) => ({title: title(value), value}))},
      }),
      defineField({name: 'locale', title: 'Locale', type: 'string'}),
      defineField({
        name: 'occurrences',
        title: 'Times seen',
        type: 'number',
        description: 'How many approved runs have now produced this same correction.',
      }),
      defineField({
        name: 'rationale',
        title: 'Why',
        type: 'text',
        rows: 2,
      }),

      // --- The payload, one field per kind ---
      defineField({
        name: 'term',
        title: 'Source term',
        type: 'string',
        hidden: ({parent}) => parent?.kind !== 'glossary-term',
      }),
      defineField({
        name: 'translation',
        title: 'Approved translation',
        type: 'string',
        hidden: ({parent}) => parent?.kind !== 'glossary-term',
      }),
      defineField({
        name: 'rule',
        title: 'Style rule',
        type: 'text',
        rows: 2,
        hidden: ({parent}) => parent?.kind !== 'style-rule',
      }),
      defineField({
        name: 'coordinates',
        title: 'Eval case',
        type: 'object',
        description: 'Coordinates a fixture script resolves; not a stored fixture.',
        hidden: ({parent}) => parent?.kind !== 'eval-case',
        fields: [
          defineField({name: 'locale', type: 'string'}),
          defineField({name: 'targetId', title: 'Target document', type: 'string'}),
          defineField({name: 'targetRev', title: 'Machine revision', type: 'string'}),
          defineField({name: 'sourceRev', title: 'Source revision', type: 'string'}),
        ],
      }),

      // --- What the reviewer judges it on ---
      defineField({
        name: 'evidence',
        title: 'Evidence',
        type: 'object',
        fields: [
          defineField({name: 'fieldPath', title: 'Field', type: 'string'}),
          defineField({name: 'sourceExcerpt', title: 'Source', type: 'text', rows: 2}),
          defineField({name: 'machineText', title: 'Machine translation', type: 'text', rows: 2}),
          defineField({name: 'humanText', title: 'What was approved', type: 'text', rows: 2}),
        ],
      }),

      // --- Provenance ---
      defineField({
        name: 'subject',
        title: 'Source document',
        type: 'reference',
        to: subjectTypes.map((type) => ({type})),
        weak: true,
        description: 'The document whose localization taught this. May since have been deleted.',
      }),
      defineField({
        name: 'run',
        title: 'Workflow run',
        type: 'string',
        description: 'The instance id, in the workflows dataset.',
      }),
    ],
    orderings: [
      {
        title: 'Most repeated',
        name: 'occurrencesDesc',
        by: [
          {field: 'occurrences', direction: 'desc'},
          {field: '_createdAt', direction: 'desc'},
        ],
      },
      {title: 'Newest', name: 'createdDesc', by: [{field: '_createdAt', direction: 'desc'}]},
    ],
    preview: {
      select: {
        kind: 'kind',
        locale: 'locale',
        occurrences: 'occurrences',
        rule: 'rule',
        term: 'term',
        translation: 'translation',
      },
      prepare({kind, locale, occurrences, rule, term, translation}) {
        const repeats = typeof occurrences === 'number' && occurrences > 1 ? ` ×${occurrences}` : ''
        const headline =
          kind === 'glossary-term'
            ? `“${term}” → “${translation}”`
            : (rule ?? `${title(String(kind ?? ''))} candidate`)

        return {
          title: `${headline}${repeats}`,
          subtitle: [locale, title(String(kind ?? ''))].filter(Boolean).join(' · '),
        }
      },
    },
  })
}

function title(kind: string): string {
  return kind.replace(/-/g, ' ').replace(/^./, (first) => first.toUpperCase())
}
