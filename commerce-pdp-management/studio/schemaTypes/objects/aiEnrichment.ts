import {defineField, defineType} from 'sanity'

/**
 * AI generation + review metadata on an attribute rule. Content Agent writes
 * drafts with `aiGenerated: true`; a reviewer stamps `reviewedBy` / `reviewedAt`
 * on approval. `generationContext` references the brandVoice singleton that
 * governed the generation run.
 */
export const aiEnrichment = defineType({
  name: 'aiEnrichment',
  title: 'AI & review',
  type: 'object',
  options: {collapsible: true, collapsed: true},
  fields: [
    defineField({
      name: 'generatedAt',
      title: 'Generated at',
      type: 'datetime',
      readOnly: true,
    }),
    defineField({
      name: 'generationContext',
      title: 'Generation context',
      type: 'reference',
      to: [{type: 'brandVoice'}],
      description: 'The brand voice document used as context for this generation.',
    }),
    defineField({
      name: 'reviewNotes',
      title: 'Review notes',
      type: 'blockContent',
      description: 'Reviewer feedback, e.g. why a document was sent back to draft.',
    }),
    defineField({
      name: 'reviewedBy',
      title: 'Reviewed by',
      type: 'string',
      description: 'Reviewer who approved this document.',
    }),
    defineField({
      name: 'reviewedAt',
      title: 'Reviewed at',
      type: 'datetime',
      readOnly: true,
    }),
  ],
})
