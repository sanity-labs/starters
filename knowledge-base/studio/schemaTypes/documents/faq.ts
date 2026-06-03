import {HelpCircleIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

import {audienceField, reviewByDateField, statusField, taxonomyFields} from '../shared'

// External Q&A pairs — each document is a tight semantic unit for embeddings.
export const faq = defineType({
  name: 'faq',
  title: 'FAQ',
  type: 'document',
  icon: HelpCircleIcon,
  fields: [
    defineField({
      name: 'question',
      title: 'Question',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'answer',
      title: 'Answer',
      type: 'blockContent',
      validation: (rule) => rule.required(),
    }),
    audienceField,
    ...taxonomyFields,
    statusField,
    // FAQs carry the review clock but skip owner/lastReviewedAt — they're small
    // enough to re-verify in place.
    reviewByDateField,
  ],
  preview: {
    select: {title: 'question', status: 'status'},
    prepare({title, status}) {
      return {title, subtitle: status}
    },
  },
})
