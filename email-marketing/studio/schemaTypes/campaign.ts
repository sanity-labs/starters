import {defineField, defineType} from 'sanity'
import {RocketIcon} from '@sanity/icons'

export const campaign = defineType({
  name: 'campaign',
  title: 'Campaign',
  type: 'document',
  icon: RocketIcon,
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
      hidden: true,
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'Planning', value: 'planning'},
          {title: 'Active', value: 'active'},
          {title: 'Completed', value: 'completed'},
        ],
        layout: 'radio',
      },
      initialValue: 'planning',
    }),
    defineField({
      name: 'list',
      title: 'Subscriber List',
      type: 'reference',
      to: [{type: 'list'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'audiences',
      title: 'Audiences',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'audience'}]}],
    }),
    defineField({
      name: 'emails',
      title: 'Emails',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'emailMessage'}]}],
    }),
  ],
  preview: {
    select: {
      title: 'title',
      status: 'status',
    },
    prepare: ({title, status}) => ({
      title: title ?? 'Untitled Campaign',
      subtitle: status ? status.charAt(0).toUpperCase() + status.slice(1) : undefined,
    }),
  },
})
