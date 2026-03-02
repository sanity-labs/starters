import {defineField, defineType} from 'sanity'

export const category = defineType({
  name: 'category',
  title: 'Categories',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Category name (e.g., "T-Shirts", "Trousers")',
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
      name: 'parent',
      title: 'Parent Category',
      type: 'reference',
      to: [{type: 'category'}],
      description: 'Parent category for hierarchy (leave empty for top-level)',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      description: 'Category description for SEO and context search',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      parentTitle: 'parent.title',
      grandparentTitle: 'parent.parent.title',
    },
    prepare({title, parentTitle, grandparentTitle}) {
      const path = [grandparentTitle, parentTitle, title].filter(Boolean).join(' > ')
      return {
        title: title,
        subtitle: parentTitle ? path : 'Top-level category',
      }
    },
  },
})
