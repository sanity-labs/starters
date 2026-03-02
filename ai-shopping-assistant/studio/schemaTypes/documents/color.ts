import {defineField, defineType} from 'sanity'

export const color = defineType({
  name: 'color',
  title: 'Colors',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Color name (e.g., "Navy Blue", "Heather Grey")',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description: 'URL-friendly identifier',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'hexValue',
      title: 'Hex Value',
      type: 'string',
      description: 'Hex color code (e.g., "#1F3A5F") for color swatches',
      validation: (rule) =>
        rule
          .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
            name: 'hex color',
            invert: false,
          })
          .warning('Should be a valid hex color code (e.g., #1F3A5F)'),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      hexValue: 'hexValue',
    },
    prepare({title, hexValue}) {
      return {
        title: title,
        subtitle: hexValue || 'No hex value set',
      }
    },
  },
})
