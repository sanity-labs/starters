import {defineType, defineField, type FieldsetDefinition} from 'sanity'
import {localeTypeName} from '../types'
import {isValidLocale, getFlagFromCode} from '../utils'
import {EarthGlobeIcon} from '@sanity/icons'

const nameFieldset = {
  name: 'name',
  title: 'Name',
} as const satisfies FieldsetDefinition

export const translationLocale = defineType({
  name: localeTypeName,
  title: 'Translation Locale',
  icon: EarthGlobeIcon,
  type: 'document',
  fieldsets: [nameFieldset],
  fields: [
    defineField({
      name: 'title',
      title: 'Display Name',
      type: 'string',
      description: 'Human-readable name (e.g., "German (Germany)")',
      fieldset: nameFieldset.name,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'nativeName',
      title: 'Native Name',
      type: 'string',
      description: 'Name in the locale\'s own language (e.g., "Deutsch")',
      fieldset: nameFieldset.name,
    }),
    defineField({
      name: 'code',
      title: 'Locale Code',
      type: 'string',
      description: 'BCP-47 locale code (e.g., en-US, de-DE, ja-JP)',
      validation: (rule) =>
        rule
          .required()
          .custom((code) => isValidLocale(code) || 'Must be a valid BCP-47 locale code'),
    }),
    defineField({
      name: 'fallback',
      title: 'Fallback Locale',
      type: 'reference',
      to: [{type: localeTypeName}],
      description:
        'If a translation is missing for this locale, the system will fall back to this locale',
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
    {
      title: 'Code, A–Z',
      name: 'codeAsc',
      by: [{field: 'code', direction: 'asc'}],
    },
    {
      title: 'Code, Z–A',
      name: 'codeDesc',
      by: [{field: 'code', direction: 'desc'}],
    },
  ],
  preview: {
    select: {
      title: 'title',
      code: 'code',
      nativeName: 'nativeName',
    },
    prepare({title, code, nativeName}, viewOptions) {
      const flag = code ? getFlagFromCode(code) : null
      const sortField = viewOptions?.ordering?.by[0]?.field
      const subtitle = sortField === 'code' ? (nativeName ?? code) : code
      return {
        title: flag ? `${flag} ${title}` : title,
        subtitle,
      }
    },
  },
})
