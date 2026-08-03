import {defineField, defineType} from 'sanity'
import {UserIcon} from '@sanity/icons'

export const author = defineType({
  name: 'author',
  title: 'Author',
  type: 'document',
  icon: UserIcon,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: {source: 'name', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'role',
      type: 'string',
      description: 'e.g. Contributing editor, Photographer',
    }),
    defineField({
      name: 'image',
      title: 'Portrait',
      type: 'image',
      options: {hotspot: true},
      fields: [{name: 'alt', type: 'string', title: 'Alternative text'}],
    }),
    defineField({name: 'bio', type: 'text', rows: 3}),
  ],
  preview: {
    select: {title: 'name', subtitle: 'role', media: 'image'},
  },
})
