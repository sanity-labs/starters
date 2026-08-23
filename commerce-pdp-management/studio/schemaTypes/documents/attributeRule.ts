import {defineArrayMember, defineField, defineType} from 'sanity'
import {ComposeIcon} from '@sanity/icons'

/**
 * The core enrichment unit. A reusable editorial block (care guide, fit
 * descriptor, lifestyle story, spec sheet, launch note) applied to many products
 * via tag matching — authored once, resolved for every product that matches.
 *
 * Only `approved` rules are eligible for the control plane priority list.
 */
export const attributeRule = defineType({
  name: 'attributeRule',
  title: 'Attribute rule',
  type: 'document',
  icon: ComposeIcon,
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'matching', title: 'Matching'},
    {name: 'review', title: 'AI & review'},
  ],
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      group: 'content',
      description: 'Editorial label, e.g. "Where to Wear — Leisurewear".',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      group: 'content',
      initialValue: 'lifestyle',
      description:
        'Within a category the highest-priority matching rule wins; rules across categories accumulate.',
      options: {
        list: [
          {title: 'Care', value: 'care'},
          {title: 'Fit', value: 'fit'},
          {title: 'Lifestyle', value: 'lifestyle'},
          {title: 'Spec', value: 'spec'},
          {title: 'Launch', value: 'launch'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'blockContent',
      group: 'content',
      description: 'The content rendered on every matching product page.',
    }),
    defineField({
      name: 'icon',
      title: 'Icon',
      type: 'image',
      group: 'content',
      description: 'Optional icon shown alongside the attribute on the PDP.',
    }),

    // ── Matching ──
    defineField({
      name: 'tags',
      title: 'Tags (inclusion)',
      type: 'array',
      group: 'matching',
      of: [defineArrayMember({type: 'string'})],
      options: {layout: 'tags'},
      description:
        'Shopify tags — ALL must be present on a product for this rule to match, e.g. "activity:Lounge".',
    }),
    defineField({
      name: 'excludedTags',
      title: 'Excluded tags (exclusion)',
      type: 'array',
      group: 'matching',
      of: [defineArrayMember({type: 'string'})],
      options: {layout: 'tags'},
      description: 'Shopify tags — ANY match disqualifies the rule, e.g. "Nova Sport Mens".',
    }),
    defineField({
      name: 'language',
      title: 'Language',
      type: 'string',
      group: 'matching',
      initialValue: 'en',
      description: 'Language code for locale-specific attribute content.',
    }),
    defineField({
      name: 'order',
      title: 'Display order',
      type: 'number',
      group: 'matching',
      initialValue: 0,
      description:
        'Display position within a product’s resolved attribute set (lower shows first).',
      validation: (rule) => rule.integer(),
    }),

    // ── AI & review ──
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      group: 'review',
      initialValue: 'draft',
      description: 'Only approved rules are eligible for the control plane.',
      options: {
        list: [
          {title: 'Draft', value: 'draft'},
          {title: 'In review', value: 'in-review'},
          {title: 'Approved', value: 'approved'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'aiGenerated',
      title: 'AI generated',
      type: 'boolean',
      group: 'review',
      initialValue: false,
      description: 'Marks Content Agent drafts for the review queue.',
    }),
    defineField({
      name: 'aiEnrichment',
      title: 'AI & review metadata',
      type: 'aiEnrichment',
      group: 'review',
    }),
  ],
  preview: {
    select: {title: 'name', category: 'category', status: 'status', ai: 'aiGenerated'},
    prepare({title, category, status, ai}) {
      const flags = [category, status, ai ? 'AI' : null].filter(Boolean).join(' · ')
      return {title: title || 'Untitled rule', subtitle: flags}
    },
  },
})
