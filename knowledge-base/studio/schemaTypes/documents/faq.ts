import {HelpCircleIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

import {audienceField, statusField, taxonomyFields} from '../shared'

// Structured Q&A for GROQ mode. Exact facts belong here; long-form how-to
// belongs on helpArticle (and the Knowledge Base that indexes it).
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
  ],
  preview: {
    select: {title: 'question', status: 'status'},
    prepare({title, status}) {
      return {title, subtitle: status}
    },
  },
})
