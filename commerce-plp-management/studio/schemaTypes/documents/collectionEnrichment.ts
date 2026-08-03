import {defineField, defineType} from 'sanity'
import {ThLargeIcon} from '@sanity/icons'
import {findInactiveGids, shopifyConfigured} from '../../lib/shopifyStudio'

/**
 * The core document. Presence of a collectionEnrichment for a handle activates
 * the editorial layer; absence means the storefront renders pure Shopify output.
 *
 * - shopify-native: Shopify owns membership/order; Sanity layers editorial on top.
 * - sanity-custom:  Sanity owns membership/order via productList; Shopify supplies
 *   live product data by GID batch.
 */
export const collectionEnrichment = defineType({
  name: 'collectionEnrichment',
  title: 'Collection',
  type: 'document',
  icon: ThLargeIcon,
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'products', title: 'Products'},
    {name: 'merchandising', title: 'Merchandising'},
    {name: 'personalization', title: 'Personalization'},
    {name: 'system', title: 'System'},
  ],
  fields: [
    defineField({
      name: 'handle',
      title: 'Collection handle',
      type: 'slug',
      group: 'content',
      description:
        'Shopify collection handle (or a Sanity-custom handle). The join key between Sanity and Shopify. Immutable after first publish.',
      options: {maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'collectionType',
      title: 'Collection type',
      type: 'string',
      group: 'content',
      initialValue: 'shopify-native',
      options: {
        list: [
          {title: 'Shopify-native (enrich an existing collection)', value: 'shopify-native'},
          {title: 'Sanity-custom (curated campaign collection)', value: 'sanity-custom'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'title',
      title: 'Display title',
      type: 'string',
      group: 'content',
      description: 'Optional. Overrides the Shopify collection title on the storefront.',
    }),
    defineField({name: 'banner', title: 'Banner', type: 'banner', group: 'content'}),

    // ── Products ──
    defineField({
      name: 'faceout',
      title: 'Faceout',
      type: 'faceout',
      group: 'products',
      description: 'Pinned hero product rendered at grid position 0.',
      validation: (rule) =>
        rule.custom(async (value) => {
          const gid = (value as {product?: {productGid?: string}})?.product?.productGid
          if (!gid || !shopifyConfigured) return true
          const inactive = await findInactiveGids([gid])
          return inactive.length ? 'Faceout product is not active in Shopify' : true
        }),
    }),
    defineField({
      name: 'productList',
      title: 'Product list',
      type: 'array',
      group: 'products',
      of: [{type: 'product'}],
      description:
        'Curated membership and order. Used only for sanity-custom collections; drag to reorder.',
      hidden: ({parent}) => parent?.collectionType !== 'sanity-custom',
      validation: (rule) =>
        rule.custom(async (value, context) => {
          const parent = context.document as {collectionType?: string} | undefined
          if (parent?.collectionType !== 'sanity-custom') return true
          const list = (value as {productGid?: string}[] | undefined) ?? []
          const gids = list.map((p) => p?.productGid).filter((g): g is string => Boolean(g))
          if (!gids.length || !shopifyConfigured) return true
          const inactive = await findInactiveGids(gids)
          return inactive.length
            ? {message: `${inactive.length} product(s) are not active in Shopify`, level: 'warning'}
            : true
        }),
    }),
    defineField({
      name: 'pinnedRecs',
      title: 'Pinned recommendations',
      type: 'array',
      group: 'products',
      of: [{type: 'product'}],
      description: 'Optional products that override algorithmic recommendation slots.',
    }),

    // ── Merchandising ──
    defineField({
      name: 'editorialTiles',
      title: 'Editorial tiles',
      type: 'array',
      group: 'merchandising',
      of: [{type: 'editorialTile'}],
    }),
    defineField({
      name: 'badges',
      title: 'Badges',
      type: 'array',
      group: 'merchandising',
      of: [{type: 'badgeAssignment'}],
    }),
    defineField({
      name: 'facetConfig',
      title: 'Promoted facets',
      type: 'array',
      group: 'merchandising',
      of: [{type: 'facetConfig'}],
    }),

    // ── Personalization (interim) ──
    defineField({
      name: 'variantOverrides',
      title: 'Audience variants',
      type: 'array',
      group: 'personalization',
      of: [{type: 'variantOverride'}],
      description:
        'Interim audience-targeted overrides (ahead of Content Variants). Non-sensitive segments only.',
    }),

    // ── System ──
    defineField({
      name: 'syncStatus',
      title: 'Shopify sync',
      type: 'syncState',
      group: 'system',
    }),
  ],
  preview: {
    select: {title: 'title', handle: 'handle.current', type: 'collectionType'},
    prepare({title, handle, type}) {
      const label = type === 'sanity-custom' ? 'Custom' : 'Native'
      return {title: title || handle || 'Untitled collection', subtitle: `${label} · ${handle}`}
    },
  },
})
