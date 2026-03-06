import {defineType, defineField} from 'sanity'
import {UserIcon} from '@sanity/icons'

export const person = defineType({
  name: 'person',
  title: 'Person',
  type: 'document',
  icon: UserIcon,
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'bio',
      title: 'Bio',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: true},
    }),
  ],
  orderings: [
    {
      title: 'Name, A–Z',
      name: 'nameAsc',
      by: [{field: 'name', direction: 'asc'}],
    },
    {
      title: 'Name, Z–A',
      name: 'nameDesc',
      by: [{field: 'name', direction: 'desc'}],
    },
  ],
  preview: {
    select: {
      title: 'name',
      media: 'image',
      description: 'bio',
    },
  },
})
