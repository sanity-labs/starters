import {defineField, defineType} from 'sanity'

/** Promotes a Shopify filter facet and optionally relabels it. Order matters. */
export const facetConfig = defineType({
  name: 'facetConfig',
  title: 'Promoted facet',
  type: 'object',
  fields: [
    defineField({
      name: 'facetHandle',
      title: 'Facet handle',
      type: 'string',
      description: 'The Shopify filter id, e.g. "filter.v.option.size".',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'labelOverride',
      title: 'Label override',
      type: 'string',
      description: 'Optional display label shown instead of the Shopify label.',
    }),
  ],
  preview: {
    select: {title: 'labelOverride', subtitle: 'facetHandle'},
    prepare({title, subtitle}) {
      return {title: title || subtitle || 'Facet', subtitle}
    },
  },
})
