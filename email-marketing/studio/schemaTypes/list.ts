import {defineField, defineType} from 'sanity'
import {UsersIcon} from '@sanity/icons'
import {KlaviyoDocumentDescription} from '../components/KlaviyoDocumentDescription'

export const list = defineType({
  name: 'list',
  title: 'List',
  type: 'document',
  icon: UsersIcon,
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
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'externalId',
      title: 'Klaviyo ID',
      type: 'string',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      description:
        'Describe this list — who subscribes and why. Helps editors and AI understand the audience.',
    }),
    defineField({
      name: 'audienceNotes',
      title: 'Audience Notes',
      type: 'text',
      rows: 3,
      description:
        'Tone and style guidance for content targeting this list. For example: "Professional tone — these are B2B decision-makers."',
    }),
  ],
  preview: {
    select: {title: 'name'},
  },
})
