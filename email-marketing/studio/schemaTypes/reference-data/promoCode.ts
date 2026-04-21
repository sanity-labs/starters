import {defineField, defineType} from 'sanity'

export const promoCode = defineType({
  name: 'promoCode',
  title: 'Promo Code',
  type: 'document',
  fields: [
    defineField({
      name: 'code',
      title: 'Code',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'discountValue',
      title: 'Discount Value',
      type: 'string',
      description: 'e.g., "20% off", "$25 off", "Free Shipping"',
    }),
  ],
  preview: {
    select: {title: 'code', discount: 'discountValue'},
    prepare: ({title, discount}) => ({
      title,
      subtitle: discount,
    }),
  },
})
