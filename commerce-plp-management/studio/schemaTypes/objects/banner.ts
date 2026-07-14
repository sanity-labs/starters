import {defineField, defineType} from 'sanity'
import {THEME_OPTIONS} from '../../lib/theme'

/** Hero banner rendered above the product grid. */
export const banner = defineType({
  name: 'banner',
  title: 'Banner',
  type: 'object',
  fields: [
    defineField({
      name: 'image',
      title: 'Hero image',
      type: 'image',
      options: {hotspot: true},
      fields: [defineField({name: 'alt', title: 'Alt text', type: 'string'})],
    }),
    defineField({
      name: 'headline',
      title: 'Headline',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'subhead', title: 'Subhead', type: 'string'}),
    defineField({name: 'ctaLabel', title: 'CTA label', type: 'string'}),
    defineField({name: 'ctaHref', title: 'CTA link', type: 'string'}),
    defineField({
      name: 'theme',
      title: 'Color block',
      type: 'string',
      initialValue: 'yellow',
      options: {list: [...THEME_OPTIONS], layout: 'radio'},
    }),
  ],
  preview: {
    select: {title: 'headline', subtitle: 'subhead', media: 'image'},
  },
})
