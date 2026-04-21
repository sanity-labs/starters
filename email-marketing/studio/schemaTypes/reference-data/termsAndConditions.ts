import {defineField, defineType} from 'sanity'

export const termsAndConditions = defineType({
  name: 'termsAndConditions',
  title: 'Terms & Conditions',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'disclaimer',
      title: 'Disclaimer Text',
      type: 'text',
      rows: 5,
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare: ({title}) => ({title}),
  },
})
