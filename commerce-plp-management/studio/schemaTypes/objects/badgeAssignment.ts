import {defineField, defineType} from 'sanity'

/** Assigns a badge from the shared vocabulary to a product for a date window. */
export const badgeAssignment = defineType({
  name: 'badgeAssignment',
  title: 'Badge assignment',
  type: 'object',
  fields: [
    defineField({
      name: 'product',
      title: 'Product',
      type: 'product',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'badge',
      title: 'Badge',
      type: 'reference',
      to: [{type: 'productBadge'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'customLabel',
      title: 'Custom label',
      type: 'string',
      description: 'Overrides the badge label. Use with a custom badge.',
    }),
    defineField({
      name: 'startDate',
      title: 'Start date',
      type: 'datetime',
      description: 'Badge appears at this time. Leave empty for immediately.',
    }),
    defineField({
      name: 'endDate',
      title: 'End date',
      type: 'datetime',
      description: 'Badge disappears at this time. Leave empty for open-ended.',
      validation: (rule) =>
        rule.custom((endDate, context) => {
          const start = (context.parent as {startDate?: string})?.startDate
          if (endDate && start && new Date(endDate) < new Date(start)) {
            return 'End date must be after the start date'
          }
          return true
        }),
    }),
  ],
  preview: {
    select: {
      productTitle: 'product.productTitle',
      badgeLabel: 'badge.label',
      custom: 'customLabel',
    },
    prepare({productTitle, badgeLabel, custom}) {
      return {
        title: custom || badgeLabel || 'Badge',
        subtitle: productTitle || 'Product',
      }
    },
  },
})
