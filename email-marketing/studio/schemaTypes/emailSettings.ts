import {defineField, defineType} from 'sanity'
import {CogIcon} from '@sanity/icons'

export const emailSettings = defineType({
  name: 'emailSettings',
  title: 'Email Settings',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({
      name: 'fromEmail',
      title: 'From Email',
      type: 'string',
      description: 'The sender email address for outgoing emails',
      validation: (rule) =>
        rule.required().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {name: 'email', invert: false}),
    }),
    defineField({
      name: 'replyToEmail',
      title: 'Reply-To Email',
      type: 'string',
      description: 'Where replies will be sent',
      validation: (rule) =>
        rule.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {name: 'email', invert: false}),
    }),
    defineField({
      name: 'fromLabel',
      title: 'From Name',
      type: 'string',
      description: 'Display name shown to recipients (e.g. "Acme Store")',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'brandVoice',
      title: 'Brand Voice',
      type: 'text',
      rows: 3,
      description:
        'Describe your brand\'s voice and personality (e.g. "We speak like a knowledgeable friend — approachable but credible")',
    }),
    defineField({
      name: 'brandToneKeywords',
      title: 'Brand Tone Keywords',
      type: 'array',
      of: [{type: 'string'}],
      options: {layout: 'tags'},
      description: 'Tone descriptors that define your brand (e.g. "warm", "professional", "witty")',
    }),
    defineField({
      name: 'brandGuidelines',
      title: 'Brand Guidelines',
      type: 'text',
      rows: 4,
      description:
        'Specific do\'s and don\'ts for written communication (e.g. "Never use exclamation marks. Always address the reader as you.")',
    }),
  ],
  preview: {
    prepare: () => ({title: 'Email Settings'}),
  },
})
