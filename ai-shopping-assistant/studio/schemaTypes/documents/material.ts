import {defineField, defineType} from 'sanity'

export const material = defineType({
  name: 'material',
  title: 'Materials',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Material name (e.g., "100% Organic Cotton", "Cotton/Polyester Blend")',
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
      name: 'composition',
      title: 'Composition',
      type: 'text',
      rows: 4,
      description:
        'Detailed fabric information for context search (e.g., "Soft, breathable organic cotton grown without pesticides. Pre-shrunk for lasting fit.")',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      composition: 'composition',
    },
    prepare({title, composition}) {
      return {
        title: title,
        subtitle: composition ? composition.substring(0, 50) + '...' : undefined,
      }
    },
  },
})
