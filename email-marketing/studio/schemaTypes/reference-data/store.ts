import {defineField, defineType} from 'sanity'

export const store = defineType({
  name: 'store',
  title: 'Store',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Store Name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'code',
      title: 'Store Code',
      type: 'string',
      description: 'Unique identifier for the store (e.g., "US_NEW_YORK").',
    }),
  ],
  preview: {
    select: {title: 'title', code: 'code'},
    prepare: ({title, code}) => ({title, subtitle: code}),
  },
})
