import {defineField} from 'sanity'

// Reusable fields shared across content types. Keeping them in one place means
// the external (helpArticle, faq) and internal (playbook, policy) types stay
// structurally aligned — the same taxonomy and governance shape everywhere.

export const summaryField = defineField({
  name: 'summary',
  title: 'Summary',
  type: 'text',
  rows: 3,
  // Plain text, not Portable Text: used verbatim for agent card display and as a
  // tight semantic unit. Keep it self-contained.
  description: 'One-paragraph summary shown on cards and used for semantic retrieval.',
  validation: (rule) => rule.required().max(320),
})

export const audienceField = defineField({
  name: 'audience',
  title: 'Audience',
  type: 'array',
  of: [{type: 'string'}],
  options: {
    list: [
      {title: 'Developer', value: 'developer'},
      {title: 'Admin', value: 'admin'},
      {title: 'End user', value: 'end-user'},
    ],
  },
  description: 'Who this is for. Leave empty to apply to everyone.',
})

export const statusField = defineField({
  name: 'status',
  title: 'Status',
  type: 'string',
  options: {
    list: [
      {title: 'Draft', value: 'draft'},
      {title: 'Published', value: 'published'},
      {title: 'Archived', value: 'archived'},
    ],
    layout: 'radio',
  },
  initialValue: 'draft',
  validation: (rule) => rule.required(),
})

export const taxonomyFields = [
  defineField({
    name: 'products',
    title: 'Products',
    type: 'array',
    of: [{type: 'reference', to: [{type: 'product'}]}],
  }),
  defineField({
    name: 'topics',
    title: 'Topics',
    type: 'array',
    of: [{type: 'reference', to: [{type: 'topic'}]}],
  }),
]

export const reviewByDateField = defineField({
  name: 'reviewByDate',
  title: 'Review by',
  type: 'datetime',
  // Set to publish + 90 days by the set-review-date Function when unset.
  description:
    'When this content next needs review. Overdue items surface in the Needs Review queue.',
})

export const governanceFields = [
  defineField({
    name: 'owner',
    title: 'Owner',
    type: 'string',
    description: 'Person or team responsible for keeping this current.',
  }),
  defineField({
    name: 'lastReviewedAt',
    title: 'Last reviewed',
    type: 'datetime',
  }),
  reviewByDateField,
]

export const importanceField = defineField({
  name: 'importance',
  title: 'Importance',
  type: 'string',
  options: {
    list: [
      {title: 'Standard', value: 'standard'},
      {title: 'Critical', value: 'critical'},
    ],
    layout: 'radio',
  },
  initialValue: 'standard',
  // Critical internal content is prioritized in agent responses.
  description: 'Critical items are surfaced first in agent answers.',
})
