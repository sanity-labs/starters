/**
 * Hidden fields added to the `translation.metadata` document type
 * (defined by @sanity/document-internationalization).
 *
 * These fields are written at runtime by Sanity Functions and the translation
 * inspector but were never declared in the schema — TypeGen typed them as `null`.
 * Defining them here makes TypeGen generate correct types.
 *
 * All fields are `hidden: true` so they don't appear in the Studio form.
 */

import {defineArrayMember, defineField} from 'sanity'

/**
 * Per-locale workflow state (needsReview, approved, stale, etc.).
 * Written by mark-translations-stale and the translation inspector.
 */
export const workflowStatesField = defineField({
  name: 'workflowStates',
  type: 'array',
  hidden: true,
  of: [
    defineArrayMember({
      type: 'object',
      fields: [
        defineField({
          name: 'status',
          type: 'string',
          options: {list: ['missing', 'usingFallback', 'needsReview', 'approved', 'stale']},
        }),
        defineField({name: 'source', type: 'string', options: {list: ['ai', 'manual']}}),
        defineField({name: 'updatedAt', type: 'string'}),
        defineField({name: 'reviewedBy', type: 'string'}),
        defineField({name: 'sourceRevision', type: 'string'}),
        defineField({name: 'staleSourceRev', type: 'string'}),
      ],
    }),
  ],
})

/**
 * Cached AI stale-change analysis + pre-translations.
 * Written by analyze-stale-translations, read by the translation inspector.
 */
export const staleAnalysisField = defineField({
  name: 'staleAnalysis',
  type: 'object',
  hidden: true,
  fields: [
    defineField({name: 'sourceRevision', type: 'string'}),
    defineField({name: 'analyzedAt', type: 'string'}),
    defineField({
      name: 'result',
      type: 'object',
      fields: [
        defineField({
          name: 'materiality',
          type: 'string',
          options: {list: ['cosmetic', 'minor', 'material']},
        }),
        defineField({name: 'explanation', type: 'string'}),
        defineField({name: 'droppedSuggestionCount', type: 'number'}),
        defineField({
          name: 'suggestions',
          type: 'array',
          of: [
            defineArrayMember({
              type: 'object',
              fields: [
                defineField({name: 'fieldName', type: 'string'}),
                defineField({name: 'explanation', type: 'string'}),
                defineField({
                  name: 'recommendation',
                  type: 'string',
                  options: {list: ['retranslate', 'dismiss']},
                }),
                defineField({name: 'changeSummary', type: 'string'}),
                defineField({
                  name: 'reasonCode',
                  type: 'string',
                  options: {
                    list: [
                      'fact_changed',
                      'cta_changed',
                      'tone_only',
                      'formatting_only',
                      'content_added',
                      'content_removed',
                      'date_or_number_changed',
                      'other',
                    ],
                  },
                }),
                defineField({
                  name: 'impactTags',
                  type: 'array',
                  of: [defineArrayMember({type: 'string'})],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'preTranslations',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({name: 'fieldName', type: 'string'}),
            defineField({name: 'localeId', type: 'string'}),
            // suggestedValue is `unknown` (string | PT blocks) — not representable
            // in a Sanity schema. GROQ returns it as-is; consumer code casts.
          ],
        }),
      ],
    }),
    defineField({
      name: 'reviewProgress',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({name: 'sourceRevision', type: 'string'}),
            defineField({name: 'localeId', type: 'string'}),
            // fields: Record<string, 'applied' | 'skipped'> — dynamic key map,
            // not representable in Sanity schema. Consumer code casts.
          ],
        }),
      ],
    }),
  ],
})
