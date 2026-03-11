import {defineField, defineType} from 'sanity'
import {UsersIcon} from '@sanity/icons'
import {KlaviyoDocumentDescription} from '../components/KlaviyoDocumentDescription'

export const list = defineType({
  name: 'list',
  title: 'List',
  type: 'document',
  icon: UsersIcon,
  readOnly: true,
  fields: [
    defineField({
      name: 'klaviyoDescription',
      title: 'Klaviyo',
      type: 'string',
      components: {input: KlaviyoDocumentDescription},
      readOnly: true,
    }),
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'externalId',
      title: 'Klaviyo ID',
      type: 'string',
      hidden: true,
    }),
  ],
  preview: {
    select: {title: 'name'},
  },
})
