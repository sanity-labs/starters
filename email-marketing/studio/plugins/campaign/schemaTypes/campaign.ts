import {defineField, defineType} from 'sanity'
import {RocketIcon} from '@sanity/icons'

/**
 * Campaign (the brief)
 *
 * Governance unit of work: goals, messaging, audience segments, launch window, tone traits.
 * Promotions (artifacts) inherit from the campaign by reference.
 */
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
      name: 'store',
      title: 'Store',
      type: 'reference',
      to: [{type: 'store'}],
    }),
    defineField({
      name: 'urgencyStage',
      title: 'Urgency Stage',
      type: 'reference',
      to: [{type: 'urgencyStage'}],
    }),
    defineField({
      name: 'segments',
      title: 'Target Segments',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'segment'}]}],
      description: 'Segments to generate variant promotions for.',
    }),
    defineField({
      name: 'startDate',
      title: 'Start Date',
      type: 'date',
    }),
    defineField({
      name: 'endDate',
      title: 'End Date',
      type: 'date',
    }),
    defineField({
      name: 'primaryMessage',
      title: 'Primary Message',
      type: 'text',
      rows: 3,
      description: 'Core message of the campaign.',
    }),
    defineField({
      name: 'supportingMessage',
      title: 'Supporting Message',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'valueProposition',
      title: 'Value Proposition',
      type: 'text',
      rows: 3,
      description: 'What is the offer or benefit?',
    }),
    defineField({
      name: 'emotionalGoal',
      title: 'Emotional Goal',
      type: 'string',
      description: 'e.g., FOMO, excitement, aspiration, trust',
    }),
    defineField({
      name: 'toneTraits',
      title: 'Tone Traits',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        layout: 'tags',
      },
      description: 'e.g., urgent, playful, aspirational, inclusive',
    }),
    defineField({
      name: 'previewContext',
      title: 'Preview Context (Personalization Tokens)',
      type: 'object',
      description:
        'Sample data for personalization tokens ({{first_name}}, {{last_purchase_date}}, etc.)',
      fields: [
        defineField({
          name: 'tokens',
          title: 'Tokens',
          type: 'array',
          of: [
            defineField({
              type: 'object',
              name: 'token',
              fields: [
                defineField({name: 'key', title: 'Token Name', type: 'string'}),
                defineField({name: 'sample', title: 'Sample Value', type: 'string'}),
                defineField({name: 'description', title: 'Description', type: 'string'}),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
  preview: {
    select: {
      title: 'title',
      startDate: 'startDate',
      segments: 'segments',
    },
    prepare: ({title, startDate, segments}) => ({
      title: title ?? 'Untitled Campaign',
      subtitle: [
        startDate ? new Date(startDate).toLocaleDateString() : '',
        segments?.length ? `${segments.length} segments` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    }),
  },
})
