import {defineField, defineType} from 'sanity'
import {RocketIcon} from '@sanity/icons'
import {GenerateCampaignEmailButton} from '../components/GenerateCampaignEmailButton'

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
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'creativeBrief',
      title: 'Creative Brief',
      type: 'object',
      components: {input: GenerateCampaignEmailButton},
      fields: [
        defineField({
          name: 'goal',
          title: 'Goal',
          type: 'text',
          rows: 2,
          description: 'What this email campaign aims to achieve',
        }),
        defineField({
          name: 'keyMessage',
          title: 'Key Message',
          type: 'text',
          rows: 2,
          description: 'The core offer or message',
        }),
        defineField({
          name: 'useAudienceContext',
          title: 'Use context from lists and segments',
          type: 'boolean',
          initialValue: true,
        }),
        defineField({
          name: 'additionalContext',
          title: 'Additional Context',
          type: 'text',
          rows: 3,
          description: 'Tone of voice overrides, audience-specific tweaks, freeform notes',
        }),
        defineField({
          name: 'generationCount',
          title: 'Times Generated',
          type: 'number',
          readOnly: true,
          hidden: true,
          initialValue: 0,
        }),
        defineField({
          name: 'lastGeneratedAt',
          title: 'Last Generated At',
          type: 'datetime',
          readOnly: true,
          hidden: true,
        }),
      ],
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
      name: 'email',
      title: 'Email',
      type: 'reference',
      to: [{type: 'emailMessage'}],
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
