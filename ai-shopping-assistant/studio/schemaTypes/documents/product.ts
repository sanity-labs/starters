import {defineArrayMember, defineField, defineType} from 'sanity'

export const product = defineType({
  name: 'product',
  title: 'Products',
  type: 'document',
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'details', title: 'Details'},
    {name: 'inventory', title: 'Inventory'},
    {name: 'seo', title: 'SEO'},
  ],
  fields: [
    // Content Group
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Product name (e.g., "Classic Crew Neck T-Shirt")',
      group: 'content',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description: 'URL-friendly identifier',
      group: 'content',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sku',
      title: 'SKU',
      type: 'string',
      description: 'Base product SKU (e.g., "TSHIRT-CREW-001")',
      group: 'content',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'shortDescription',
      title: 'Short Description',
      type: 'text',
      rows: 2,
      description: 'Brief description for product listings (max 200 characters)',
      group: 'content',
      validation: (rule) =>
        rule.max(200).warning('Keep short descriptions under 200 characters for best display'),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'array',
      description: 'Full product description with rich text formatting',
      group: 'content',
      of: [
        defineArrayMember({
          type: 'block',
          styles: [{title: 'Normal', value: 'normal'}],
          marks: {
            decorators: [
              {title: 'Bold', value: 'strong'},
              {title: 'Italic', value: 'em'},
            ],
            annotations: [
              {
                name: 'link',
                type: 'object',
                title: 'Link',
                fields: [
                  defineField({
                    name: 'href',
                    type: 'url',
                    title: 'URL',
                    validation: (rule) =>
                      rule.uri({
                        scheme: ['http', 'https', 'mailto'],
                      }),
                  }),
                ],
              },
            ],
          },
          lists: [
            {title: 'Bullet', value: 'bullet'},
            {title: 'Numbered', value: 'number'},
          ],
        }),
      ],
    }),
    // Details Group
    defineField({
      name: 'category',
      title: 'Category',
      type: 'reference',
      to: [{type: 'category'}],
      description: 'Product category',
      group: 'details',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'brand',
      title: 'Brand',
      type: 'reference',
      to: [{type: 'brand'}],
      description: 'Product brand',
      group: 'details',
    }),
    defineField({
      name: 'materials',
      title: 'Materials',
      type: 'array',
      description: 'Fabric and material composition',
      group: 'details',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'material'}],
        }),
      ],
    }),
    defineField({
      name: 'careInstructions',
      title: 'Care Instructions',
      type: 'text',
      rows: 3,
      description: 'Washing and care information (e.g., "Machine wash cold, tumble dry low")',
      group: 'details',
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      description: 'Search tags for discovery (e.g., "casual", "summer", "basics", "comfortable")',
      group: 'details',
      of: [{type: 'string'}],
      options: {
        layout: 'tags',
      },
    }),
    defineField({
      name: 'features',
      title: 'Features',
      type: 'array',
      description:
        'Product features and benefits (e.g., "Pre-shrunk", "Tagless", "Reinforced seams")',
      group: 'details',
      of: [{type: 'string'}],
      options: {
        layout: 'tags',
      },
    }),

    // Inventory Group
    defineField({
      name: 'price',
      title: 'Price',
      type: 'price',
      description: 'Product pricing in USD',
      group: 'inventory',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'variants',
      title: 'Variants',
      type: 'array',
      description: 'Color variants with available sizes',
      group: 'inventory',
      of: [
        defineArrayMember({
          type: 'productVariant',
        }),
      ],
    }),

    // SEO Group
    defineField({
      name: 'seo',
      title: 'SEO',
      type: 'seo',
      description: 'Search engine optimization settings',
      group: 'seo',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      sku: 'sku',
      category: 'category.title',
      brand: 'brand.title',
      media: 'variants.0.images.0',
    },
    prepare({title, sku, category, brand, media}) {
      return {
        title: title,
        subtitle: `${brand || 'No brand'} | ${sku || 'No SKU'} | ${category || 'Uncategorized'}`,
        media: media,
      }
    },
  },
})
