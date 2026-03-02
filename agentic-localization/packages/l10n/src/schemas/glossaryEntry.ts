import {defineType, defineField, defineArrayMember} from 'sanity'
import {glossaryEntryTypeName, localeTranslationTypeName} from '../types'
import {uniqueLocaleValidator, prepareGlossaryEntry} from '../utils'

export const glossaryEntry = defineType({
  name: glossaryEntryTypeName,
  title: 'Glossary Entry',
  type: 'object',
  fields: [
    defineField({
      name: 'term',
      title: 'Source Term',
      type: 'string',
      description: 'The term in the source language',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      description: 'Usage status per TBX standard',
      options: {
        list: [
          {title: 'Approved', value: 'approved'},
          {title: 'Forbidden', value: 'forbidden'},
          {title: 'Provisional', value: 'provisional'},
          {title: 'Non-standard', value: 'non-standard'},
        ],
        layout: 'radio',
        direction: 'horizontal',
      },
      initialValue: 'approved',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'doNotTranslate',
      title: 'Do Not Translate',
      type: 'boolean',
      description: 'Mark as DNT for brand names, product names, etc.',
      initialValue: false,
    }),
    defineField({
      name: 'partOfSpeech',
      title: 'Part of Speech',
      type: 'string',
      options: {
        list: [
          {title: 'Noun', value: 'noun'},
          {title: 'Verb', value: 'verb'},
          {title: 'Adjective', value: 'adjective'},
          {title: 'Adverb', value: 'adverb'},
          {title: 'Pronoun', value: 'pronoun'},
          {title: 'Preposition', value: 'preposition'},
          {title: 'Conjunction', value: 'conjunction'},
          {title: 'Interjection', value: 'interjection'},
          {title: 'Abbreviation', value: 'abbreviation'},
          {title: 'Phrase', value: 'phrase'},
        ],
      },
    }),
    defineField({
      name: 'definition',
      title: 'Definition',
      type: 'text',
      rows: 3,
      description: 'Definition or explanation of the term in context',
    }),
    defineField({
      name: 'context',
      title: 'Usage Context',
      type: 'string',
      description: 'Example sentence or usage context for the term',
    }),
    defineField({
      name: 'translations',
      title: 'Translations',
      type: 'array',
      of: [defineArrayMember({type: localeTranslationTypeName})],
      description: 'Approved translations per locale',
      hidden: ({parent}) => parent?.doNotTranslate === true,
      validation: (rule) => rule.custom(uniqueLocaleValidator),
    }),
  ],
  preview: {
    select: {
      title: 'term',
      status: 'status',
      dnt: 'doNotTranslate',
    },
    prepare: prepareGlossaryEntry,
  },
})
