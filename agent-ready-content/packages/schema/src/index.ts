import {defineField, defineType} from 'sanity'

/**
 * Documentation content model: sections contain articles.
 * Kept deliberately small. The point of this starter is the markdown
 * delivery pattern, not the content model. Swap in your own types and
 * keep the serializers in @agent-ready/markdown in sync.
 */

// Top-level groupings like "Getting started", "API reference"
export const section = defineType({
  name: 'section',
  title: 'Section',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title'},
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      description: 'Shown in section listings, the sitemap, and llms.txt',
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
      description: 'Display order in navigation',
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'description'},
  },
})

// Individual documentation articles
export const article = defineType({
  name: 'article',
  title: 'Article',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title'},
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'section',
      title: 'Section',
      type: 'reference',
      to: [{type: 'section'}],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'summary',
      title: 'Summary',
      type: 'text',
      description:
        'One or two sentences. Used in listings, the sitemap, and llms.txt, so agents read this before deciding to fetch the article.',
      validation: (Rule) => Rule.required().max(300),
    }),
    defineField({
      name: 'content',
      title: 'Content',
      type: 'array',
      of: [{type: 'block'}, {type: 'code'}, {type: 'image'}, {type: 'callout'}],
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
      description: 'Display order within section',
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'section.title'},
  },
})

// Code block with language and optional filename.
// The filename survives into markdown as ```lang:path fences.
export const codeBlock = defineType({
  name: 'code',
  title: 'Code block',
  type: 'object',
  fields: [
    defineField({
      name: 'code',
      title: 'Code',
      type: 'text',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'language',
      title: 'Language',
      type: 'string',
      options: {
        list: [
          {title: 'JavaScript', value: 'javascript'},
          {title: 'TypeScript', value: 'typescript'},
          {title: 'Bash', value: 'bash'},
          {title: 'JSON', value: 'json'},
        ],
      },
    }),
    defineField({
      name: 'filename',
      title: 'Filename',
      type: 'string',
    }),
  ],
  preview: {
    select: {title: 'filename', subtitle: 'language'},
    prepare: ({title, subtitle}) => ({title: title || 'Code block', subtitle}),
  },
})

// Callout for notes, tips, and warnings.
// Styles map 1:1 onto GitHub Flavored Markdown alerts (> [!NOTE] etc.)
export const callout = defineType({
  name: 'callout',
  title: 'Callout',
  type: 'object',
  fields: [
    defineField({
      name: 'style',
      title: 'Style',
      type: 'string',
      options: {
        list: [
          {title: 'Note', value: 'note'},
          {title: 'Tip', value: 'tip'},
          {title: 'Important', value: 'important'},
          {title: 'Warning', value: 'warning'},
          {title: 'Caution', value: 'caution'},
        ],
      },
      initialValue: 'note',
    }),
    defineField({
      name: 'content',
      title: 'Content',
      type: 'array',
      of: [{type: 'block'}],
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {style: 'style'},
    prepare: ({style}) => ({title: `Callout (${style || 'note'})`}),
  },
})

export const schemaTypes = [section, article, codeBlock, callout]
