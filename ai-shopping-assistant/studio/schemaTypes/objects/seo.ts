import {defineField, defineType} from 'sanity'

export const seo = defineType({
  name: 'seo',
  title: 'SEO',
  type: 'object',
  fields: [
    defineField({
      name: 'metaTitle',
      title: 'Meta Title',
      type: 'string',
      description: 'Title for search engines (recommended: 50-60 characters)',
      validation: (rule) =>
        rule.max(60).warning('Meta titles over 60 characters may be truncated in search results'),
    }),
    defineField({
      name: 'metaDescription',
      title: 'Meta Description',
      type: 'text',
      rows: 3,
      description: 'Description for search engines (recommended: 150-160 characters)',
      validation: (rule) =>
        rule
          .max(160)
          .warning('Meta descriptions over 160 characters may be truncated in search results'),
    }),
    defineField({
      name: 'keywords',
      title: 'Keywords',
      type: 'array',
      of: [{type: 'string'}],
      description: 'Additional search terms to help with content discovery',
      options: {
        layout: 'tags',
      },
    }),
  ],
})
