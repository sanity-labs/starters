import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * Per-product-type priority override. Brands with distinct taxonomies (e.g.
 * "Footwear" vs "Apparel") can reorder rules for one product type without
 * touching the global priority list.
 */
export const productTypeScope = defineType({
  name: 'productTypeScope',
  title: 'Product-type scope',
  type: 'object',
  fields: [
    defineField({
      name: 'productType',
      title: 'Product type',
      type: 'string',
      description: 'Shopify product type this override applies to (exact match).',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'priorityList',
      title: 'Priority list',
      type: 'array',
      description: 'Approved attribute rules, in resolution order for this product type.',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'attributeRule'}],
          options: {filter: 'status == "approved"'},
        }),
      ],
    }),
  ],
  preview: {
    select: {title: 'productType', rules: 'priorityList'},
    prepare({title, rules}) {
      const count = Array.isArray(rules) ? rules.length : 0
      return {title: title || 'Product type', subtitle: `${count} rule(s)`}
    },
  },
})
