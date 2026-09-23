import {PackageIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType} from 'sanity'

export const product = defineType({
  name: 'product',
  title: 'Product',
  type: 'document',
  icon: PackageIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'planTier',
      title: 'Plan tier',
      type: 'string',
      options: {
        list: [
          {title: 'Starter', value: 'starter'},
          {title: 'Growth', value: 'growth'},
          {title: 'Enterprise', value: 'enterprise'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'priceMonthly',
      title: 'Monthly price (USD)',
      type: 'number',
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'channels',
      title: 'Channels',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      options: {
        list: [
          {title: 'Email', value: 'email'},
          {title: 'SMS', value: 'sms'},
          {title: 'Push', value: 'push'},
          {title: 'In-app', value: 'in-app'},
        ],
      },
    }),
    defineField({
      name: 'seatLimit',
      title: 'Seat limit',
      type: 'number',
      description: 'Included seats. Use 0 for unlimited.',
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'features',
      title: 'Features',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
    }),
    defineField({
      name: 'icon',
      title: 'Icon',
      type: 'string',
      description: 'Icon identifier the frontend maps to a glyph.',
    }),
  ],
  preview: {
    select: {title: 'title', planTier: 'planTier', priceMonthly: 'priceMonthly'},
    prepare({title, planTier, priceMonthly}) {
      return {
        title,
        subtitle: [planTier, typeof priceMonthly === 'number' && `$${priceMonthly}/mo`]
          .filter(Boolean)
          .join(' · '),
      }
    },
  },
})
