import {FolderIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const internalCategory = defineType({
  name: 'internalCategory',
  title: 'Internal Category',
  type: 'document',
  icon: FolderIcon,
  // Organizes internal content (playbooks, policies). Safe to include in the
  // external agent context for retrieval precision — it carries no sensitive data.
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 2,
    }),
  ],
})
