import {defineField, defineType} from 'sanity'
import {UsersIcon} from '@sanity/icons'
import {ErrorBanner} from '../components/ErrorBanner'

export const list = defineType({
  name: 'list',
  title: 'List',
  type: 'document',
  icon: UsersIcon,
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
      hidden: false,
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'externalId',
      title: 'External ID',
      type: 'string',
      description: 'ID from your email service provider',
      readOnly: true,
      hidden: false,
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
      hidden: false,
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
    select: {title: 'name'},
  },
})
