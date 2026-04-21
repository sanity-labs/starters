import {defineField, defineType} from 'sanity'

export const urgencyStage = defineType({
  name: 'urgencyStage',
  title: 'Urgency Stage',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Stage Name',
      type: 'string',
      validation: (rule) => rule.required(),
      description: 'e.g., "Flash Sale", "Limited Time", "Exclusive Offer"',
    }),
    defineField({
      name: 'copyTone',
      title: 'Copy Tone Guidance',
      type: 'text',
      rows: 3,
      description: 'How should copy sound? e.g., "Urgent, time-limited, fear-of-missing-out"',
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare: ({title}) => ({title}),
  },
})
