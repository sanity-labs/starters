/**
 * Schema for `fieldTranslation.metadata` — per-field workflow state tracking.
 *
 * Parallel to `translation.metadata` (doc-level) but tracks field × locale
 * workflow states for `internationalizedArray*` fields.
 *
 * - `liveEdit: true` — patches write directly to published (no draft)
 * - `hidden: true` — internal, not visible in desk structure
 * - Deterministic ID: `fieldTranslation.metadata.<publishedId>`
 */

import {defineArrayMember, defineField, defineType} from 'sanity'

export const fieldTranslationMetadata = defineType({
  name: 'fieldTranslation.metadata',
  title: 'Field Translation Metadata',
  type: 'document',
  liveEdit: true,
  hidden: true,
  fields: [
    defineField({
      name: 'documentRef',
      title: 'Source Document',
      type: 'reference',
      weak: true,
      to: [{type: 'person' as string}],
      hidden: true,
    }),
    defineField({
      name: 'documentType',
      title: 'Document Type',
      type: 'string',
      hidden: true,
    }),
    defineField({
      name: 'workflowStates',
      title: 'Workflow States',
      type: 'array',
      hidden: true,
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({name: 'field', type: 'string'}),
            defineField({name: 'language', type: 'string'}),
            defineField({
              name: 'status',
              type: 'string',
              options: {list: ['needsReview', 'approved', 'stale']},
            }),
            defineField({
              name: 'source',
              type: 'string',
              options: {list: ['ai', 'manual']},
            }),
            defineField({name: 'updatedAt', type: 'string'}),
            defineField({name: 'reviewedBy', type: 'string'}),
            defineField({name: 'sourceSnapshot', type: 'text'}),
          ],
        }),
      ],
    }),
  ],
})
