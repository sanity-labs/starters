import {defineArrayMember, defineField, defineType} from 'sanity'

export const emailHeader = defineType({
  name: 'emailHeader',
  title: 'Header',
  type: 'object',
  fields: [
    defineField({
      name: 'logoUrl',
      title: 'Logo',
      type: 'image',
    }),
    defineField({
      name: 'brandName',
      title: 'Brand Name',
      type: 'string',
    }),
  ],
  preview: {
    select: {title: 'brandName'},
    prepare: ({title}) => ({title: title ?? 'Header'}),
  },
})

export const emailSection = defineType({
  name: 'emailSection',
  title: 'Section',
  type: 'object',
  fields: [
    defineField({
      name: 'headline',
      title: 'Headline',
      type: 'string',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'text',
      rows: 4,
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
    }),
    defineField({
      name: 'products',
      title: 'Products',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'product'}]}],
    }),
  ],
  preview: {
    select: {title: 'headline'},
    prepare: ({title}) => ({title: title ?? 'Section'}),
  },
})

export const emailCTA = defineType({
  name: 'emailCTA',
  title: 'CTA Button',
  type: 'object',
  fields: [
    defineField({
      name: 'text',
      title: 'Text',
      type: 'string',
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
    }),
    defineField({
      name: 'style',
      title: 'Style',
      type: 'string',
      options: {
        list: [
          {title: 'Primary', value: 'primary'},
          {title: 'Secondary', value: 'secondary'},
        ],
        layout: 'radio',
      },
      initialValue: 'primary',
    }),
  ],
  preview: {
    select: {title: 'text'},
    prepare: ({title}) => ({title: title ?? 'CTA'}),
  },
})

export const emailDivider = defineType({
  name: 'emailDivider',
  title: 'Divider',
  type: 'object',
  fields: [
    defineField({
      name: 'spacing',
      title: 'Spacing',
      type: 'string',
      options: {
        list: [
          {title: 'Small', value: 'small'},
          {title: 'Medium', value: 'medium'},
          {title: 'Large', value: 'large'},
        ],
        layout: 'radio',
      },
      initialValue: 'medium',
    }),
  ],
  preview: {
    prepare: () => ({title: '— Divider —'}),
  },
})

export const emailFooter = defineType({
  name: 'emailFooter',
  title: 'Footer',
  type: 'object',
  fields: [
    defineField({
      name: 'legalText',
      title: 'Legal Text',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'unsubscribeText',
      title: 'Unsubscribe Text',
      type: 'string',
    }),
  ],
  preview: {
    prepare: () => ({title: 'Footer'}),
  },
})

/**
 * Array members for use in promotion.emailSlots
 */
export const emailBlockArrayMembers = [
  defineArrayMember({type: 'emailHeader'}),
  defineArrayMember({type: 'emailSection'}),
  defineArrayMember({type: 'emailCTA'}),
  defineArrayMember({type: 'emailDivider'}),
  defineArrayMember({type: 'emailFooter'}),
]
