import {defineField, defineType} from 'sanity'
import {SyncStatusInput} from '../../components/SyncStatusInput'

/** System field written by the push-sync Function. Read-only for merchandisers. */
export const syncState = defineType({
  name: 'syncState',
  title: 'Sync status',
  type: 'object',
  readOnly: true,
  components: {input: SyncStatusInput},
  fields: [
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'Never synced', value: 'never'},
          {title: 'Pending', value: 'pending'},
          {title: 'Synced', value: 'synced'},
          {title: 'Failed', value: 'failed'},
        ],
      },
      initialValue: 'never',
    }),
    defineField({name: 'lastSyncedAt', title: 'Last synced at', type: 'datetime'}),
    defineField({name: 'error', title: 'Error', type: 'text'}),
  ],
})
