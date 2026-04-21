import {defineField, defineType} from 'sanity'
import {EnvelopeIcon} from '@sanity/icons'
import {emailSlotArrayMember} from './emailSlot'

/**
 * Promotion (the artifact)
 *
 * Segment-variant artifact: one base promotion + N segment-variant promotions per campaign.
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
      description: 'Null for base promotion; set for segment-variant promotions.',
    }),
    defineField({
      name: 'isBasePromotion',
      title: 'Is Base Promotion',
      type: 'boolean',
      description: 'True if this is the base variant (applies to all segments by default).',
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
      description: 'Short trigger phrase (max 3 words) to catch attention.',
    }),
    defineField({
      name: 'emailSlots',
      title: 'Email Slots',
      type: 'array',
      of: [emailSlotArrayMember],
      description:
        'Modular slots (top-banner, module-1, module-2) with independent assets and CTAs.',
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
  ],
  preview: {
    select: {
      title: 'subjectLine',
      segment: 'segment',
      isBase: 'isBasePromotion',
    },
    prepare: ({title, segment, isBase}) => ({
      title: title ?? 'Untitled',
      subtitle: isBase ? 'Base Promotion' : segment ? `Segment variant` : 'Unassigned',
    }),
  },
})
