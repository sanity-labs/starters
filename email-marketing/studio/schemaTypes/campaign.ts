import {defineField, defineType} from 'sanity'
import {RocketIcon} from '@sanity/icons'

export const campaign = defineType({
  name: 'campaign',
  title: 'Campaign',
  type: 'document',
  icon: RocketIcon,
  fieldsets: [
    {
      name: 'targeting',
      title: 'Targeting',
      description:
        'Control who receives this campaign. Recipients in any included list or segment will receive emails. Excluded segments are always removed from the send.',
      options: {collapsible: true, collapsed: false},
    },
  ],
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
      name: 'lists',
      title: 'Subscriber Lists',
      type: 'array',
      fieldset: 'targeting',
      description: 'The subscriber lists for this campaign. Select one or more lists from Klaviyo.',
      of: [{type: 'reference', to: [{type: 'list'}]}],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'includedSegments',
      title: 'Included Segments',
      type: 'array',
      fieldset: 'targeting',
      description:
        'Segments to include. Recipients in ANY included list or segment will receive emails. If empty, all subscribers on the selected lists receive emails.',
      of: [{type: 'reference', to: [{type: 'segment'}]}],
    }),
    defineField({
      name: 'excludedSegments',
      title: 'Excluded Segments',
      type: 'array',
      fieldset: 'targeting',
      description:
        'Segments to exclude. Anyone in these segments will be removed from the send, even if they match an included list or segment.',
      of: [{type: 'reference', to: [{type: 'segment'}]}],
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
