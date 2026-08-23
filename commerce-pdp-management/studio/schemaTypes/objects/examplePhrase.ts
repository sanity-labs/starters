import {defineField, defineType} from 'sanity'

/** A do/don't pair guiding the brand voice for AI generation. */
export const examplePhrase = defineType({
  name: 'examplePhrase',
  title: 'Example phrase',
  type: 'object',
  fields: [
    defineField({
      name: 'do',
      title: 'Do',
      type: 'string',
      description: 'On-brand phrasing to emulate.',
    }),
    defineField({
      name: 'dont',
      title: "Don't",
      type: 'string',
      description: 'Off-brand phrasing to avoid.',
    }),
  ],
  preview: {
    select: {title: 'do', subtitle: 'dont'},
    prepare({title, subtitle}) {
      return {title: title || 'Example', subtitle: subtitle ? `Avoid: ${subtitle}` : undefined}
    },
  },
})
