import {defineField, defineType} from 'sanity'

export const size = defineType({
  name: 'size',
  title: 'Sizes',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Full size name (e.g., "Medium", "Extra Large")',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'code',
      title: 'Code',
      type: 'string',
      description: 'Short code (e.g., "M", "XL")',
      validation: (rule) => rule.required().max(5),
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number',
      description: 'Display order (e.g., XS=1, S=2, M=3, L=4, XL=5)',
      validation: (rule) => rule.min(0),
    }),
  ],
  orderings: [
    {
      title: 'Sort Order',
      name: 'sortOrderAsc',
      by: [{field: 'sortOrder', direction: 'asc'}],
    },
  ],
  preview: {
    select: {
      title: 'title',
      code: 'code',
      sortOrder: 'sortOrder',
    },
    prepare({title, code, sortOrder}) {
      return {
        title: `${code} - ${title}`,
        subtitle: sortOrder !== undefined ? `Sort order: ${sortOrder}` : undefined,
      }
    },
  },
})
