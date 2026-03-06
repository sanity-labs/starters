import {defineType, defineField} from 'sanity'
import {localeTranslationTypeName, localeTypeName} from '../types'

export const localeTranslation = defineType({
  name: localeTranslationTypeName,
  title: 'Locale Translation',
  type: 'object',
  fields: [
    defineField({
      name: 'locale',
      title: 'Locale',
      type: 'reference',
      to: [{type: localeTypeName}],
      options: {disableNew: true},
      description: 'Target locale for this translation',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'translation',
      title: 'Translation',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'gender',
      title: 'Grammatical Gender',
      type: 'string',
      options: {
        list: [
          {title: 'Masculine', value: 'masculine'},
          {title: 'Feminine', value: 'feminine'},
          {title: 'Neuter', value: 'neuter'},
          {title: 'Common', value: 'common'},
          {title: 'Animate', value: 'animate'},
          {title: 'Inanimate', value: 'inanimate'},
        ],
      },
    }),
  ],
  preview: {
    select: {
      title: 'translation',
      subtitle: 'locale.title',
    },
  },
})
