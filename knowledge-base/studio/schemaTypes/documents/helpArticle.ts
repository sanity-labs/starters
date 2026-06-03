import {DocumentTextIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

import {audienceField, governanceFields, statusField, summaryField, taxonomyFields} from '../shared'

// External, customer-facing procedural help content.
export const helpArticle = defineType({
  name: 'helpArticle',
  title: 'Help Article',
  type: 'document',
  icon: DocumentTextIcon,
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
    audienceField,
    ...taxonomyFields,
    statusField,
    ...governanceFields,
  ],
  preview: {
    select: {title: 'title', status: 'status', reviewByDate: 'reviewByDate'},
    prepare({title, status, reviewByDate}) {
      const overdue = reviewByDate && new Date(reviewByDate) < new Date()
      return {
        title,
        subtitle: [status, overdue && '⚠ review overdue'].filter(Boolean).join(' · '),
      }
    },
  },
})
