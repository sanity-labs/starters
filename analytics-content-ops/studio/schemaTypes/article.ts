import {defineArrayMember, defineField, defineType} from 'sanity'
import {DocumentTextIcon} from '@sanity/icons'
import {AGENT_REVIEW_STATUSES, EDITORIAL_PRIORITIES} from '../lib/performance'

export const article = defineType({
  name: 'article',
  title: 'Article',
  type: 'document',
  icon: DocumentTextIcon,
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'seo', title: 'SEO'},
    {name: 'editorial', title: 'Editorial signal'},
  ],
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      group: 'content',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      group: 'content',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'excerpt',
      title: 'Excerpt (dek)',
      type: 'text',
      rows: 3,
      group: 'content',
      description: 'Short standfirst shown in listings and at the top of the article.',
      validation: (rule) => rule.max(240).warning('Keep it under 240 characters.'),
    }),
    defineField({
      name: 'authors',
      type: 'array',
      group: 'content',
      of: [defineArrayMember({type: 'reference', to: [{type: 'author'}]})],
      validation: (rule) => rule.min(1).error('Add at least one author.'),
    }),
    defineField({
      name: 'category',
      type: 'reference',
      group: 'content',
      to: [{type: 'category'}],
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
      group: 'content',
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'mainImage',
      title: 'Main image',
      type: 'image',
      group: 'content',
      options: {hotspot: true},
      fields: [{name: 'alt', type: 'string', title: 'Alternative text'}],
    }),
    defineField({
      name: 'body',
      type: 'blockContent',
      group: 'content',
    }),
    defineField({
      name: 'sourceUrl',
      title: 'Original source URL',
      type: 'url',
      group: 'content',
      description: 'Optional link to the original article this post is based on.',
      validation: (rule) => rule.uri({scheme: ['http', 'https']}),
    }),

    // ── SEO ────────────────────────────────────────────────────────────────
    // The agent stages improvements to these fields during nightly triage.
    defineField({
      name: 'seoTitle',
      title: 'SEO title',
      type: 'string',
      group: 'seo',
      validation: (rule) => rule.max(70).warning('Aim for under 70 characters.'),
    }),
    defineField({
      name: 'seoDescription',
      title: 'SEO description',
      type: 'text',
      rows: 2,
      group: 'seo',
      validation: (rule) => rule.max(160).warning('Aim for under 160 characters.'),
    }),

    // ── Editorial signal ─────────────────────────────────────────────────────
    // The editor's action response to the performance signal shown on the
    // Performance panel. Set by hand — never by the analytics sync.
    defineField({
      name: 'editorialPriority',
      title: 'Editorial priority',
      type: 'string',
      group: 'editorial',
      description: 'Flag how this article should be handled after reviewing its performance.',
      options: {
        layout: 'radio',
        list: EDITORIAL_PRIORITIES.map((value) => ({
          value,
          title: value.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()),
        })),
      },
    }),

    // Agent review state machine. Written by the sync (queued) and the triage
    // function (in_progress → staged); resolved by editors (approved/dismissed).
    defineField({
      name: 'agentReview',
      title: 'Agent review',
      type: 'object',
      group: 'editorial',
      options: {collapsible: true, collapsed: true},
      fields: [
        defineField({
          name: 'status',
          type: 'string',
          initialValue: 'idle',
          options: {
            list: AGENT_REVIEW_STATUSES.map((value) => ({
              value,
              title: value.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()),
            })),
          },
        }),
        defineField({
          name: 'agentNotes',
          title: 'Agent notes',
          type: 'text',
          rows: 5,
          description: 'Reasoning plus improvement opportunities written by the triage agent.',
        }),
        defineField({name: 'releaseId', title: 'Release ID', type: 'string'}),
        defineField({name: 'reviewedAt', title: 'Reviewed at', type: 'datetime'}),
      ],
    }),
  ],
  preview: {
    select: {title: 'title', author: 'authors.0.name', media: 'mainImage'},
    prepare({title, author, media}) {
      return {title, subtitle: author ? `by ${author}` : undefined, media}
    },
  },
})
