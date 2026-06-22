import {RocketIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

import {
  audienceField,
  governanceFields,
  importanceField,
  statusField,
  summaryField,
  taxonomyFields,
} from '../shared'

// Internal operational how-to for customer-facing teams: sales motions,
// onboarding, escalation procedures, objection handling. Same shape as
// helpArticle plus importance + internalCategory.
export const playbook = defineType({
  name: 'playbook',
  title: 'Playbook',
  type: 'document',
  icon: RocketIcon,
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
        subtitle: [importance, overdue && '⚠ review overdue'].filter(Boolean).join(' · '),
      }
    },
  },
})
