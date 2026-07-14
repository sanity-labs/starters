import {defineField, defineType} from 'sanity'
import {UsersIcon} from '@sanity/icons'

/**
 * Interim audience-targeted override, resolved at the storefront edge.
 *
 * AHEAD OF PRODUCT: this is the designed interim for audience-targeted PLPs
 * before Content Variants ships. All variant content is included in the GROQ
 * response, so this is only appropriate for non-sensitive segmentation (loyalty
 * vs. new visitor). When Content Variants ships, migrate these to Content
 * Variant document references — do not keep this field past Content Variants GA.
 */
export const variantOverride = defineType({
  name: 'variantOverride',
  title: 'Audience variant',
  type: 'object',
  icon: UsersIcon,
  fields: [
    defineField({
      name: 'audienceTag',
      title: 'Audience tag',
      type: 'string',
      description: 'Segment key resolved at the edge, e.g. "loyalty-member".',
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'banner', title: 'Banner override', type: 'banner'}),
    defineField({name: 'faceout', title: 'Faceout override', type: 'faceout'}),
    defineField({
      name: 'editorialTiles',
      title: 'Editorial tiles override',
      type: 'array',
      of: [{type: 'editorialTile'}],
    }),
  ],
  preview: {
    select: {title: 'audienceTag'},
    prepare({title}) {
      return {title: title || 'Audience variant', subtitle: 'Interim personalization'}
    },
  },
})
