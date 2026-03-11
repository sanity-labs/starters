import {defineType, defineField, defineArrayMember} from 'sanity'
import {DocumentTextIcon} from '@sanity/icons'
import {isUniqueOtherThanLanguage} from '../lib/isUniqueOtherThanLanguage'

export const article = defineType({
  name: 'article',
  title: 'Article',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title', isUnique: isUniqueOtherThanLanguage},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'author',
      title: 'Author',
      type: 'reference',
      to: [{type: 'person'}],
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
      options: {
        allowTimeZoneSwitch: true,
      },
    }),
    defineField({
      name: 'excerpt',
      title: 'Excerpt',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'mainImage',
      title: 'Main Image',
      type: 'image',
      options: {hotspot: true},
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      of: [
        defineArrayMember({type: 'block'}),
        defineArrayMember({type: 'image', options: {hotspot: true}}),
      ],
    }),
    defineField({
      name: 'topics',
      title: 'Topics',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'editorialTopic'}],
        }),
      ],
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'tag'}]})],
    }),
  ],
  orderings: [
    {
      title: 'Title, A–Z',
      name: 'titleAsc',
      by: [{field: 'title', direction: 'asc'}],
    },
    {
      title: 'Title, Z–A',
      name: 'titleDesc',
      by: [{field: 'title', direction: 'desc'}],
    },
    {
      title: 'Published Date, New',
      name: 'publishedAtDesc',
      by: [{field: 'publishedAt', direction: 'desc'}],
    },
    {
      title: 'Published Date, Old',
      name: 'publishedAtAsc',
      by: [{field: 'publishedAt', direction: 'asc'}],
    },
    {
      title: 'Author, A–Z',
      name: 'authorAsc',
      by: [{field: 'author.name', direction: 'asc'}],
    },
    {
      title: 'Author, Z–A',
      name: 'authorDesc',
      by: [{field: 'author.name', direction: 'desc'}],
    },
  ],
  preview: {
    select: {
      title: 'title',
      media: 'mainImage',
      author: 'author.name',
      publishedAt: 'publishedAt',
      excerpt: 'excerpt',
    },
    prepare({title, media, author, publishedAt, excerpt}, viewOptions) {
      const sortField = viewOptions?.ordering?.by[0]?.field
      const subtitle =
        sortField === 'publishedAt'
          ? publishedAt
            ? new Date(publishedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : undefined
          : author
      return {title, subtitle, description: excerpt, media}
    },
  },
})
