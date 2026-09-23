import {DocumentTextIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

import {audienceField, statusField, summaryField, taxonomyFields} from '../shared'

// Customer-facing procedural help. Reaches the customer Knowledge Base as a
// dataset source. Fix the article here; the next KB build inherits the change.
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
  ],
  preview: {
    select: {title: 'title', status: 'status'},
    prepare({title, status}) {
      return {title, subtitle: status}
    },
  },
})
