import {defineArrayMember, defineField} from 'sanity'

export const summaryField = defineField({
  name: 'summary',
  title: 'Summary',
  type: 'text',
  rows: 3,
  description: 'One-paragraph summary shown on cards and used for semantic ranking.',
  validation: (rule) => rule.required().max(320),
})

export const audienceField = defineField({
  name: 'audience',
  title: 'Audience',
  type: 'array',
  of: [defineArrayMember({type: 'string'})],
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
    of: [defineArrayMember({type: 'reference', to: [{type: 'product'}]})],
  }),
  defineField({
    name: 'topics',
    title: 'Topics',
    type: 'array',
    of: [defineArrayMember({type: 'reference', to: [{type: 'topic'}]})],
  }),
]

export const reviewByDateField = defineField({
  name: 'reviewByDate',
  title: 'Review by',
  type: 'datetime',
  description:
    'When this policy next needs editorial review. Overdue items surface in the Needs Review queue. Knowledge Base refresh is a separate, product-owned clock.',
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
  description: 'Critical policies are the ones staff should check first.',
})
