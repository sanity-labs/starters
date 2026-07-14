import {defineField, defineType} from 'sanity'
import {TagIcon} from '@sanity/icons'

/**
 * Shared badge vocabulary. Defined once, referenced from every
 * collectionEnrichment.badges entry. Because the storefront resolves badges via
 * a GROQ `->` join, changing a label or color here goes live everywhere on the
 * pull path without republishing collection documents.
 */
export const productBadge = defineType({
  name: 'productBadge',
  title: 'Product badge',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      description: 'Text shown on the badge, e.g. "Final Sale".',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'label', maxLength: 40},
      description:
        'Stable identifier. Use sale, new, final-sale, or best-seller for built-in styling; anything else renders as a custom badge.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'color',
      title: 'Color',
      type: 'string',
      initialValue: 'sale',
      options: {
        list: [
          {title: 'Sale (orange)', value: 'sale'},
          {title: 'New (blue)', value: 'new'},
          {title: 'Final sale (black)', value: 'final-sale'},
          {title: 'Best seller (yellow)', value: 'best-seller'},
          {title: 'Neutral (gray)', value: 'neutral'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'icon',
      title: 'Icon',
      type: 'string',
      description: 'Optional short emoji or glyph shown before the label.',
    }),
  ],
  preview: {
    select: {title: 'label', subtitle: 'slug.current'},
  },
})
