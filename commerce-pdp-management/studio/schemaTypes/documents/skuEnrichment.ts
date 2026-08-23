import {defineArrayMember, defineField, defineType} from 'sanity'
import {RocketIcon} from '@sanity/icons'
import {findInactiveGids, shopifyConfigured} from '../../lib/shopifyStudio'

/**
 * SKU-specific editorial for a hero product (launch, collaboration, seasonal
 * hero). Opt-in and 1:1 — layered on top of the rule-resolved attribute content
 * for a single product, matched by Shopify GID. No other products are affected.
 */
export const skuEnrichment = defineType({
  name: 'skuEnrichment',
  title: 'SKU enrichment',
  type: 'document',
  icon: RocketIcon,
  fields: [
    defineField({
      name: 'product',
      title: 'Product',
      type: 'product',
      description: 'The exact Shopify product this enrichment applies to.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'headline',
      title: 'Editorial headline',
      type: 'string',
      description: 'Overrides or supplements the Shopify title on the PDP.',
    }),
    defineField({
      name: 'editorialCopy',
      title: 'Editorial copy',
      type: 'blockContent',
      description: 'Launch narrative, product story, editorial copy.',
    }),
    defineField({
      name: 'lifestyleImages',
      title: 'Lifestyle images',
      type: 'array',
      of: [defineArrayMember({type: 'image', options: {hotspot: true}})],
    }),
    defineField({
      name: 'launchBadge',
      title: 'Launch badge',
      type: 'string',
      description: 'Badge label rendered on the PDP, e.g. "New Arrival", "Limited Edition".',
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      initialValue: 'draft',
      options: {
        list: [
          {title: 'Draft', value: 'draft'},
          {title: 'Approved', value: 'approved'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
  ],
  validation: (rule) =>
    rule.custom(async (doc) => {
      const gid = (doc as {product?: {productGid?: string}})?.product?.productGid
      if (!gid || !shopifyConfigured) return true
      const inactive = await findInactiveGids([gid])
      return inactive.length
        ? {message: 'Selected product is not active in Shopify', level: 'warning'}
        : true
    }),
  preview: {
    select: {headline: 'headline', productTitle: 'product.productTitle', status: 'status'},
    prepare({headline, productTitle, status}) {
      return {
        title: headline || productTitle || 'SKU enrichment',
        subtitle: [productTitle, status].filter(Boolean).join(' · '),
      }
    },
  },
})
