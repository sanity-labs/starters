import {defineField, defineType} from 'sanity'
import {StarIcon} from '@sanity/icons'

/** The pinned hero product, rendered at grid position 0. */
export const faceout = defineType({
  name: 'faceout',
  title: 'Faceout',
  type: 'object',
  icon: StarIcon,
  fields: [
    defineField({
      name: 'product',
      title: 'Pinned product',
      type: 'product',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'variantGid',
      title: 'Variant GID',
      type: 'string',
      description: 'Optional. Pin a specific variant, e.g. a colorway.',
    }),
    defineField({name: 'editorialHeadline', title: 'Editorial headline', type: 'string'}),
    defineField({
      name: 'imageOverride',
      title: 'Image override',
      type: 'image',
      options: {hotspot: true},
      description: 'Optional editorial image shown instead of the product photo.',
      fields: [defineField({name: 'alt', title: 'Alt text', type: 'string'})],
    }),
  ],
  preview: {
    select: {title: 'editorialHeadline', productTitle: 'product.productTitle'},
    prepare({title, productTitle}) {
      return {title: title || productTitle || 'Faceout', subtitle: 'Pinned hero product'}
    },
  },
})
