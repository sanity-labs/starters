import {defineArrayMember, defineField, defineType} from 'sanity'

export const productVariant = defineType({
  name: 'productVariant',
  title: 'Product Variant',
  type: 'object',
  fields: [
    defineField({
      name: 'color',
      title: 'Color',
      type: 'reference',
      to: [{type: 'color'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sizes',
      title: 'Available Sizes',
      type: 'array',
      description: 'Sizes available for this color variant',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'size'}],
        }),
      ],
    }),
    defineField({
      name: 'sku',
      title: 'SKU',
      type: 'string',
      description: 'Unique identifier for this variant (e.g., TSHIRT-BLU)',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'images',
      title: 'Variant Images',
      type: 'array',
      description: 'Product images for this color variant (first image is the main image)',
      of: [
        defineArrayMember({
          type: 'image',
          options: {
            hotspot: true,
          },
          fields: [
            defineField({
              name: 'alt',
              title: 'Alt Text',
              type: 'string',
              description: 'Describe the image for accessibility and SEO',
              validation: (rule) =>
                rule.required().warning('Alt text is important for accessibility'),
            }),
          ],
        }),
      ],
    }),

    defineField({
      name: 'available',
      title: 'Available for Sale',
      type: 'boolean',
      description: 'Is this variant available for purchase?',
      initialValue: true,
    }),
  ],
  preview: {
    select: {
      colorTitle: 'color.title',
      sku: 'sku',
      available: 'available',
      size0: 'sizes.0.code',
      size1: 'sizes.1.code',
      size2: 'sizes.2.code',
      size3: 'sizes.3.code',
    },
    prepare({colorTitle, sku, available, size0, size1, size2, size3}) {
      const availabilityStatus = available ? '' : ' (Unavailable)'
      const sizes = [size0, size1, size2, size3].filter(Boolean).join(', ')
      return {
        title: `${colorTitle || 'No color'}`,
        subtitle: `SKU: ${sku || 'N/A'} | Sizes: ${sizes || 'None'}${availabilityStatus}`,
      }
    },
  },
})
