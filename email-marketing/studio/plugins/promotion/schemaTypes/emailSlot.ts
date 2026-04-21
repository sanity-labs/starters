import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * Email Slot (the module)
 *
 * Modular composition: position (top-banner, module-1, module-2) + asset + headline + subheadline + CTA
 * Independent asset per slot so variant promotions can swap assets without duplication.
 */
export const emailSlot = defineType({
  name: 'emailSlot',
  title: 'Email Slot',
  type: 'object',
  fields: [
    defineField({
      name: 'position',
      title: 'Position',
      type: 'string',
      options: {
        list: [
          {title: 'Top Banner', value: 'top-banner'},
          {title: 'Module 1', value: 'module-1'},
          {title: 'Module 2', value: 'module-2'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'asset',
      title: 'Asset (DAM Reference)',
      type: 'object',
      fields: [
        defineField({name: 'url', title: 'Image URL', type: 'url'}),
        defineField({name: 'id', title: 'Asset ID (AEM)', type: 'string'}),
        defineField({name: 'altText', title: 'Alt Text', type: 'string'}),
      ],
      description: 'Image asset reference (typically AEM Dynamic Media).',
    }),
    defineField({
      name: 'headline',
      title: 'Headline',
      type: 'string',
      validation: (rule) => rule.max(100),
    }),
    defineField({
      name: 'subheadline',
      title: 'Subheadline',
      type: 'string',
      validation: (rule) => rule.max(150),
    }),
    defineField({
      name: 'cta',
      title: 'CTA',
      type: 'object',
      fields: [
        defineField({name: 'text', title: 'Button Text', type: 'string'}),
        defineField({name: 'url', title: 'URL', type: 'url'}),
      ],
    }),
  ],
  preview: {
    select: {
      position: 'position',
      headline: 'headline',
    },
    prepare: ({position, headline}) => ({
      title: `${position ?? 'Slot'} — ${headline ?? 'No headline'}`,
    }),
  },
})

/**
 * Array member for use in promotion.emailSlots
 */
export const emailSlotArrayMember = defineArrayMember({
  type: 'emailSlot',
})
