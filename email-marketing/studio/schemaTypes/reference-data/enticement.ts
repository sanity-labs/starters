import {defineField, defineType} from 'sanity'

export const enticement = defineType({
  name: 'enticement',
  title: 'Enticement',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Enticement Type',
      type: 'string',
      validation: (rule) => rule.required(),
      description: 'e.g., "Free Shipping", "Discount %", "Gift with Purchase"',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 2,
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare: ({title}) => ({title}),
  },
})
