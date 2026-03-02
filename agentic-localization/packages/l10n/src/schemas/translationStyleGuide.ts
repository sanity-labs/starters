import {defineType, defineField, defineArrayMember} from 'sanity'
import {ComposeIcon} from '@sanity/icons'
import {styleGuideTypeName, localeTypeName} from '../types'

export const translationStyleGuide = defineType({
  name: styleGuideTypeName,
  title: 'Translation Style Guide',
  type: 'document',
  icon: ComposeIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'locale',
      title: 'Target Locale',
      type: 'reference',
      to: [{type: localeTypeName}],
      options: {disableNew: true},
      description: 'The target locale this style guide applies to',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'formality',
      title: 'Formality Level',
      type: 'string',
      description: 'Maps to DeepL-style formality levels',
      options: {
        list: [
          {title: 'Formal', value: 'formal'},
          {title: 'Informal', value: 'informal'},
          {title: 'Casual', value: 'casual'},
        ],
        layout: 'radio',
        direction: 'horizontal',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'tone',
      title: 'Brand Voice / Tone',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      description: '3-5 personality adjectives describing brand voice',
      validation: (rule) => rule.min(1).max(5),
    }),
    defineField({
      name: 'additionalInstructions',
      title: 'Additional Instructions',
      type: 'array',
      description: 'Free-form additional style or translation instructions',
      of: [
        defineArrayMember({
          type: 'block',
          marks: {
            // Markdown-spec decorators only (exclude underline, strike-through)
            decorators: [
              {title: 'Bold', value: 'strong'},
              {title: 'Italic', value: 'em'},
              {title: 'Code', value: 'code'},
            ],
            annotations: [],
          },
        }),
      ],
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
      title: 'Locale, A–Z',
      name: 'localeAsc',
      by: [{field: 'locale.title', direction: 'asc'}],
    },
    {
      title: 'Locale, Z–A',
      name: 'localeDesc',
      by: [{field: 'locale.title', direction: 'desc'}],
    },
  ],
  preview: {
    select: {
      title: 'title',
      locale: 'locale.title',
      formality: 'formality',
      tone: 'tone',
    },
    prepare({title, locale, formality, tone}, viewOptions) {
      const sortField = viewOptions?.ordering?.by[0]?.field
      const subtitle =
        sortField === 'locale.title'
          ? [formality, locale].filter(Boolean).join(' – ')
          : [locale, formality].filter(Boolean).join(' – ')
      const description =
        Array.isArray(tone) && tone.length > 0 ? `Tone: ${tone.join(', ')}` : undefined
      return {title: title ?? '', subtitle, description}
    },
  },
})
