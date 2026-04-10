import {defineType, defineField} from 'sanity'

export const seo = defineType({
  name: 'seo',
  title: 'SEO',
  type: 'object',
  fields: [
    defineField({
      name: 'metaTitle',
      title: 'Meta Title',
      type: 'internationalizedArrayString',
    }),
    defineField({
      name: 'metaDescription',
      title: 'Meta Description',
      type: 'internationalizedArrayText',
    }),
  ],
})
