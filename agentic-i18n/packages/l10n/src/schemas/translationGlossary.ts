import {defineType, defineField, defineArrayMember} from 'sanity'
import {BookIcon} from '@sanity/icons'
import {glossaryTypeName, glossaryEntryTypeName, localeTypeName} from '../types'
import {prepareGlossary} from '../utils'

export const translationGlossary = defineType({
  name: glossaryTypeName,
  title: 'Translation Glossary',
  type: 'document',
  icon: BookIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Name for this glossary (e.g., "Healthcare Terminology")',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sourceLocale',
      title: 'Source Locale',
      type: 'reference',
      to: [{type: localeTypeName}],
      options: {disableNew: true},
      description: 'The source language for this glossary',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'entries',
      title: 'Glossary Entries',
      type: 'array',
      of: [defineArrayMember({type: glossaryEntryTypeName})],
    }),
  ],
  orderings: [
    {
      title: 'Title, A–Z',
      name: 'titleAsc',
      by: [{field: 'title', direction: 'asc'}],
    },
    {
      title: 'Title, Z–A',
      name: 'titleDesc',
      by: [{field: 'title', direction: 'desc'}],
    },
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'sourceLocale.title',
      entries: 'entries',
    },
    prepare: prepareGlossary,
  },
})
