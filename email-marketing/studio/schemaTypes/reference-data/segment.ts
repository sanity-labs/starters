import {defineField, defineType} from 'sanity'

/**
 * Segment (two-layer: synced + enriched)
 *
 * ReadOnly layer: synced from Resend by import-resend-segments Function.
 * Editable layer: authored by CRM manager with copy tone and affinity context.
 */
export const segment = defineType({
  name: 'segment',
  title: 'Segment',
  type: 'document',
  fields: [
    // ReadOnly synced layer
    defineField({
      name: 'externalId',
      title: 'External ID (Resend)',
      type: 'string',
      readOnly: true,
      description: 'Segment ID from Resend.',
    }),
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'type',
      title: 'Type',
      type: 'string',
      readOnly: true,
      options: {
        list: [{title: 'List', value: 'list'}],
      },
    }),
    defineField({
      name: 'memberCount',
      title: 'Member Count',
      type: 'number',
      readOnly: true,
    }),
    defineField({
      name: 'isActive',
      title: 'Active in Resend',
      type: 'boolean',
      readOnly: true,
    }),
    // TODO: remove isTest field once test segments are no longer needed
    defineField({
      name: 'isTest',
      title: 'Test Segment',
      type: 'boolean',
      readOnly: true,
      description: 'Test segments are excluded from Resend sync cleanup.',
    }),
    // Editable enrichment layer
    defineField({
      name: 'affinityDescription',
      title: 'Affinity Description',
      type: 'text',
      rows: 2,
      description: 'Who are they? e.g., "High-value repeat customers who bought jewelry in Q4"',
    }),
    defineField({
      name: 'typicalCopyTone',
      title: 'Typical Copy Tone',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        layout: 'tags',
      },
      description: 'e.g., luxury, aspirational, FOMO-driven, budget-conscious',
    }),
    defineField({
      name: 'engagementTier',
      title: 'Engagement Tier',
      type: 'string',
      options: {
        list: [
          {title: 'Low', value: 'low'},
          {title: 'Mid', value: 'mid'},
          {title: 'High', value: 'high'},
          {title: 'VIP', value: 'vip'},
        ],
      },
    }),
  ],
  preview: {
    select: {
      title: 'name',
      type: 'type',
      count: 'memberCount',
      isActive: 'isActive',
    },
    prepare: ({title, type, count, isActive}) => ({
      title: title ?? 'Untitled',
      subtitle: [
        isActive === false ? 'Inactive' : '',
        type,
        count != null ? `${count} members` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    }),
  },
})
