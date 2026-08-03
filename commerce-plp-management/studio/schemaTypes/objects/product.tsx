import {defineField, defineType} from 'sanity'
import {ProductPickerInput} from '../../components/ProductPickerInput'

/**
 * A reference to a Shopify product by GID. The GID is the join key between Sanity
 * and Shopify. Title and image are cached for display in Studio only — the
 * storefront always reads live product data from Shopify by GID.
 */
export const product = defineType({
  name: 'product',
  title: 'Product',
  type: 'object',
  components: {input: ProductPickerInput},
  fields: [
    defineField({
      name: 'productGid',
      title: 'Product GID',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'productTitle', title: 'Product title', type: 'string', readOnly: true}),
    defineField({name: 'productImageUrl', title: 'Product image', type: 'url', readOnly: true}),
  ],
  preview: {
    select: {title: 'productTitle', subtitle: 'productGid', imageUrl: 'productImageUrl'},
    prepare({title, subtitle, imageUrl}) {
      return {
        title: title || 'Unnamed product',
        subtitle: subtitle as string | undefined,
        media: imageUrl ? <img src={imageUrl as string} alt="" /> : undefined,
      }
    },
  },
})
