import {defineField, defineType} from 'sanity'

export const price = defineType({
  name: 'price',
  title: 'Price',
  type: 'object',
  fields: [
    defineField({
      name: 'amount',
      title: 'Amount',
      type: 'number',
      description: 'Price in USD',
      validation: (rule) => rule.required().min(0).error('Price must be a positive number'),
    }),
    defineField({
      name: 'compareAtPrice',
      title: 'Compare at Price',
      type: 'number',
      description: 'Original price (for displaying sale pricing)',
      validation: (rule) => rule.min(0).warning('Compare at price should be positive'),
    }),
  ],
})
