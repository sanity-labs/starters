import {defineArrayMember, defineField, defineType} from 'sanity'
import {EnvelopeIcon} from '@sanity/icons'
import {GenerateEmailButton} from '../components/GenerateEmailButton'
import {ErrorBanner} from '../components/ErrorBanner'

export const emailHeader = defineType({
  name: 'emailHeader',
  title: 'Header',
  type: 'object',
  fields: [
    defineField({
      name: 'logoUrl',
      title: 'Logo',
      type: 'image',
    }),
    defineField({
      name: 'brandName',
      title: 'Brand Name',
      type: 'string',
    }),
  ],
  preview: {
    select: {title: 'brandName'},
    prepare: ({title}) => ({title: title ?? 'Header'}),
  },
})

export const emailSection = defineType({
  name: 'emailSection',
  title: 'Section',
  type: 'object',
  fields: [
    defineField({
      name: 'headline',
      title: 'Headline',
      type: 'string',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'text',
      rows: 4,
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
    }),
    defineField({
      name: 'products',
      title: 'Products',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'product'}]}],
    }),
  ],
  preview: {
    select: {title: 'headline'},
    prepare: ({title}) => ({title: title ?? 'Section'}),
  },
})

export const emailCTA = defineType({
  name: 'emailCTA',
  title: 'CTA Button',
  type: 'object',
  fields: [
    defineField({
      name: 'text',
      title: 'Text',
      type: 'string',
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
    }),
    defineField({
      name: 'style',
      title: 'Style',
      type: 'string',
      options: {
        list: [
          {title: 'Primary', value: 'primary'},
          {title: 'Secondary', value: 'secondary'},
        ],
        layout: 'radio',
      },
      initialValue: 'primary',
    }),
  ],
  preview: {
    select: {title: 'text'},
    prepare: ({title}) => ({title: title ?? 'CTA'}),
  },
})

export const emailDivider = defineType({
  name: 'emailDivider',
  title: 'Divider',
  type: 'object',
  description: 'Adds a horizontal line between sections',
  fields: [
    defineField({
      name: 'spacing',
      title: 'Spacing',
      type: 'string',
      options: {
        list: [
          {title: 'Small', value: 'small'},
          {title: 'Medium', value: 'medium'},
          {title: 'Large', value: 'large'},
        ],
        layout: 'radio',
      },
      initialValue: 'medium',
    }),
  ],
  preview: {
    prepare: () => ({title: '— Divider —'}),
  },
})

export const emailFooter = defineType({
  name: 'emailFooter',
  title: 'Footer',
  type: 'object',
  fields: [
    defineField({
      name: 'legalText',
      title: 'Legal Text',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'unsubscribeText',
      title: 'Unsubscribe Text',
      type: 'string',
    }),
  ],
  preview: {
    prepare: () => ({title: 'Footer'}),
  },
})

export const email = defineType({
  name: 'emailMessage',
  title: 'Email',
  type: 'document',
  icon: EnvelopeIcon,
  fieldsets: [
    {
      name: 'targeting',
      title: 'Targeting',
      description:
        "By default, this email uses the campaign's segment targeting. Add segments here to override for this email only.",
      options: {collapsible: true, collapsed: true},
    },
  ],
  fields: [
    defineField({
      name: 'prompt',
      title: 'Creative Brief',
      type: 'object',
      components: {input: GenerateEmailButton},
      fields: [
        defineField({
          name: 'goal',
          title: 'Goal',
          type: 'text',
          rows: 2,
          description: 'What this email aims to achieve',
        }),
        defineField({
          name: 'keyMessage',
          title: 'Key Message',
          type: 'text',
          rows: 2,
          description: 'The core offer or message',
        }),
        defineField({
          name: 'tone',
          title: 'Tone',
          type: 'array',
          of: [{type: 'string'}],
          options: {layout: 'tags'},
          description: 'Personality descriptors (e.g. "urgent", "friendly")',
        }),
        defineField({
          name: 'additionalContext',
          title: 'Additional Context',
          type: 'text',
          rows: 3,
          description: 'Freeform notes — audience-specific tweaks, etc.',
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
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'campaign',
      title: 'Campaign',
      type: 'reference',
      to: [{type: 'campaign'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'includedSegments',
      title: 'Included Segments',
      type: 'array',
      fieldset: 'targeting',
      description:
        "Override the campaign's included segments for this email only. Leave empty to inherit from campaign.",
      of: [{type: 'reference', to: [{type: 'segment'}]}],
    }),
    defineField({
      name: 'excludedSegments',
      title: 'Excluded Segments',
      type: 'array',
      fieldset: 'targeting',
      description:
        "Override the campaign's excluded segments for this email only. Leave empty to inherit from campaign.",
      of: [{type: 'reference', to: [{type: 'segment'}]}],
    }),
    defineField({
      name: 'subject',
      title: 'Subject Line',
      type: 'string',
      validation: (rule) => rule.required().max(60),
      description: 'Max 60 characters',
    }),
    defineField({
      name: 'preheader',
      title: 'Preheader',
      type: 'string',
      validation: (rule) => rule.max(90),
      description: 'Max 90 characters',
    }),
    defineField({
      name: 'body',
      title: 'Email Body',
      type: 'array',
      of: [
        defineArrayMember({type: 'emailHeader'}),
        defineArrayMember({type: 'emailSection'}),
        defineArrayMember({type: 'emailCTA'}),
        defineArrayMember({type: 'emailDivider'}),
        defineArrayMember({type: 'emailFooter'}),
      ],
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'Draft', value: 'draft'},
          {title: 'Ready for Review', value: 'ready-for-review'},
          {title: 'Approved', value: 'approved'},
          {title: 'Sent', value: 'sent'},
        ],
        layout: 'radio',
      },
      initialValue: 'draft',
    }),
    defineField({
      name: 'sendState',
      title: 'Send State',
      type: 'string',
      options: {
        list: [
          {title: 'Idle', value: 'idle'},
          {title: 'Requested', value: 'requested'},
          {title: 'Sending', value: 'sending'},
          {title: 'Sent', value: 'sent'},
          {title: 'Error', value: 'error'},
        ],
      },
      readOnly: true,
      hidden: true,
      initialValue: 'idle',
    }),
    defineField({
      name: 'sendErrorMessage',
      title: 'Send Error Message',
      type: 'string',
      readOnly: true,
      components: {input: ErrorBanner},
    }),
    defineField({
      name: 'externalTemplateId',
      title: 'External Template ID',
      type: 'string',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'externalCampaignId',
      title: 'External Campaign ID',
      type: 'string',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'lastSentAt',
      title: 'Last Sent At',
      type: 'datetime',
      readOnly: true,
      hidden: true,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subject: 'subject',
      status: 'status',
    },
    prepare: ({title, subject, status}) => ({
      title: title ?? 'Untitled Email',
      subtitle: [subject, status].filter(Boolean).join(' · '),
    }),
  },
})
