import {defineField, defineType} from 'sanity'
import {FilterIcon} from '@sanity/icons'
import {KlaviyoDocumentDescription} from '../components/KlaviyoDocumentDescription'

export const segment = defineType({
  name: 'segment',
  title: 'Segment',
  type: 'document',
  icon: FilterIcon,
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
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      description:
        'Describe this segment — who they are and what defines them. Helps editors understand the targeting criteria.',
    }),
    defineField({
      name: 'behaviorNotes',
      title: 'Behavior Notes',
      type: 'text',
      rows: 3,
      description:
        'Tone and style guidance for AI-generated email content targeting this segment. For example: "Use casual, friendly tone — these are loyal repeat buyers."',
    }),
  ],
  preview: {
    select: {title: 'name', subtitle: 'externalId'},
  },
})
