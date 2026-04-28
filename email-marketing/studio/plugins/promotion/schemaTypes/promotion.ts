import {defineField, defineType} from 'sanity'
import {EnvelopeIcon} from '@sanity/icons'
import {emailBlockArrayMembers} from './emailBlocks'

/**
 * Promotion (the artifact)
 *
 * Segment-targeted artifact: one promotion per segment per campaign.
 * Contains subject line, preheader, disruptor, modular slots, and engagement performance metadata.
 */
export const promotion = defineType({
  name: 'promotion',
  title: 'Promotion',
  type: 'document',
  icon: EnvelopeIcon,
  fields: [
    defineField({
      name: 'campaign',
      title: 'Campaign (Brief)',
      type: 'reference',
      to: [{type: 'campaign'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'segment',
      title: 'Segment',
      type: 'reference',
      to: [{type: 'segment'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'subjectLine',
      title: 'Subject Line',
      type: 'string',
      validation: (rule) => rule.required().max(60),
      description: 'Max 60 characters.',
    }),
    defineField({
      name: 'preheader',
      title: 'Preheader',
      type: 'string',
      validation: (rule) => rule.max(90),
      description: 'Preview text shown next to subject. Max 90 characters.',
    }),
    defineField({
      name: 'disruptor',
      title: 'Disruptor',
      type: 'string',
      validation: (rule) => rule.max(20),
      description:
        'A short attention-grabbing label displayed at the top of the email body (e.g., "Flash sale", "VIP only").',
    }),
    defineField({
      name: 'emailSlots',
      title: 'Email Slots',
      type: 'array',
      of: emailBlockArrayMembers,
      description: 'Compose your email using headers, sections, CTAs, dividers, and footers.',
    }),
    defineField({
      name: 'campaignPerformance',
      title: 'Campaign Performance',
      type: 'object',
      readOnly: true,
      fields: [
        defineField({name: 'openRate', title: 'Open Rate (%)', type: 'number'}),
        defineField({name: 'clickThroughRate', title: 'CTR (%)', type: 'number'}),
        defineField({name: 'conversionRate', title: 'Conversion Rate (%)', type: 'number'}),
        defineField({name: 'notes', title: 'Notes', type: 'text', rows: 2}),
      ],
      description: 'Engagement metrics written back by ESP webhook (read-only).',
    }),
    defineField({
      name: 'testSend',
      title: 'Test Send',
      type: 'object',
      readOnly: true,
      fields: [
        defineField({
          name: 'status',
          type: 'string',
          options: {list: ['requested', 'sending', 'sent', 'error']},
        }),
        defineField({name: 'requestedAt', type: 'datetime'}),
        defineField({name: 'sentAt', type: 'datetime'}),
        defineField({name: 'sentTo', type: 'string'}),
        defineField({name: 'errorMessage', type: 'text', rows: 2}),
      ],
      description:
        'Status of the most recent "Send test email" action. Sends a transactional email to RESEND_TEST_TO (defaults to delivered@resend.dev — Resend\'s simulation address) so you can verify the integration without sending to a real audience.',
    }),
  ],
  preview: {
    select: {
      title: 'subjectLine',
      segment: 'segment',
    },
    prepare: ({title, segment}) => ({
      title: title ?? 'Untitled',
      subtitle: segment ? 'Segment promotion' : 'Unassigned',
    }),
  },
})
