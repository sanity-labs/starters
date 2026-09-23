import {LockIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

import {governanceFields, importanceField, statusField, summaryField} from '../shared'

// Internal rules. Review dates are content governance, upstream of any index.
export const policy = defineType({
  name: 'policy',
  title: 'Policy',
  type: 'document',
  icon: LockIcon,
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
    summaryField,
    defineField({
      name: 'content',
      title: 'Content',
      type: 'blockContent',
    }),
    defineField({
      name: 'internalCategory',
      title: 'Internal category',
      type: 'reference',
      to: [{type: 'internalCategory'}],
      validation: (rule) => rule.required(),
    }),
    importanceField,
    statusField,
    ...governanceFields,
  ],
  preview: {
    select: {title: 'title', importance: 'importance', reviewByDate: 'reviewByDate'},
    prepare({title, importance, reviewByDate}) {
      const overdue = reviewByDate && new Date(reviewByDate) < new Date()
      return {
        title,
        subtitle: [importance, overdue && 'review overdue'].filter(Boolean).join(' · '),
      }
    },
  },
})
