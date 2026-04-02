import {defineField, defineType} from 'sanity'
import {FilterIcon} from '@sanity/icons'
import {ErrorBanner} from '../components/ErrorBanner'

export const audience = defineType({
  name: 'audience',
  title: 'Audience',
  type: 'document',
  icon: FilterIcon,
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'name', maxLength: 96},
      hidden: true,
    }),
    defineField({
      name: 'list',
      title: 'Subscriber List',
      type: 'reference',
      to: [{type: 'list'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'behaviorNotes',
      title: 'Behavior Notes',
      type: 'text',
      rows: 3,
      description: 'Copy tone guidance for AI generation',
    }),
    defineField({
      name: 'externalId',
      title: 'External ID',
      type: 'string',
      description: 'ID from your email service provider',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'syncState',
      title: 'Sync State',
      type: 'string',
      options: {
        list: [
          {title: 'Idle', value: 'idle'},
          {title: 'Requested', value: 'requested'},
          {title: 'Syncing', value: 'syncing'},
          {title: 'Synced', value: 'synced'},
          {title: 'Error', value: 'error'},
        ],
      },
      readOnly: true,
      hidden: true,
      initialValue: 'idle',
    }),
    defineField({
      name: 'lastSyncedAt',
      title: 'Last Synced At',
      type: 'datetime',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'syncErrorMessage',
      title: 'Sync Error Message',
      type: 'string',
      readOnly: true,
      components: {input: ErrorBanner},
    }),
  ],
  preview: {
    select: {title: 'name', list: 'list.name'},
    prepare: ({title, list}) => ({
      title: title ?? 'Untitled Audience',
      subtitle: list,
    }),
  },
})
