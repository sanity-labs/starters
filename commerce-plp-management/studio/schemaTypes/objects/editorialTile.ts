import {defineField, defineType} from 'sanity'
import {BlockElementIcon} from '@sanity/icons'
import {THEME_OPTIONS} from '../../lib/theme'

/** In-grid editorial tile. Occupies a grid slot; product cards shift around it. */
export const editorialTile = defineType({
  name: 'editorialTile',
  title: 'Editorial tile',
  type: 'object',
  icon: BlockElementIcon,
  fields: [
    defineField({
      name: 'position',
      title: 'Grid position',
      type: 'number',
      description: '1-based slot in the grid where the tile is injected.',
      validation: (rule) => rule.required().integer().min(1),
    }),
    defineField({
      name: 'headline',
      title: 'Headline',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'body', title: 'Body', type: 'blockContent'}),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: true},
      fields: [defineField({name: 'alt', title: 'Alt text', type: 'string'})],
    }),
    defineField({name: 'ctaLabel', title: 'CTA label', type: 'string'}),
    defineField({name: 'ctaHref', title: 'CTA link', type: 'string'}),
    defineField({
      name: 'theme',
      title: 'Color block',
      type: 'string',
      initialValue: 'orange',
      options: {list: [...THEME_OPTIONS], layout: 'radio'},
    }),
  ],
  preview: {
    select: {title: 'headline', position: 'position', media: 'image'},
    prepare({title, position, media}) {
      return {title: title || 'Editorial tile', subtitle: `Position ${position ?? '?'}`, media}
    },
  },
})
