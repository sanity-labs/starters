import {defineField, defineType} from 'sanity'
import {SyncIcon} from '@sanity/icons'
import {EspImportDescription} from '../components/EspImportDescription'

export const espImport = defineType({
  name: 'espImport',
  title: 'Resend Import',
  type: 'document',
  icon: SyncIcon,
  fields: [
    defineField({
      name: 'description',
      title: 'Description',
      type: 'string',
      components: {input: EspImportDescription},
      readOnly: true,
    }),
    defineField({
      name: 'importState',
      title: 'Import State',
      type: 'string',
      options: {
        list: [
          {title: 'Idle', value: 'idle'},
          {title: 'Requested', value: 'requested'},
          {title: 'Importing', value: 'importing'},
          {title: 'Imported', value: 'imported'},
          {title: 'Error', value: 'error'},
        ],
      },
      readOnly: true,
      initialValue: 'idle',
    }),
    defineField({
      name: 'lastImportedAt',
      title: 'Last Imported At',
      type: 'datetime',
      readOnly: true,
    }),
    defineField({
      name: 'listCount',
      title: 'Lists Imported',
      type: 'number',
      readOnly: true,
    }),
    defineField({
      name: 'segmentCount',
      title: 'Segments Imported',
      type: 'number',
      readOnly: true,
    }),
    defineField({
      name: 'importErrorMessage',
      title: 'Error Message',
      type: 'string',
      readOnly: true,
    }),
  ],
  preview: {
    select: {
      importState: 'importState',
      listCount: 'listCount',
      segmentCount: 'segmentCount',
    },
    prepare: ({importState, listCount, segmentCount}) => ({
      title: 'Resend Import',
      subtitle:
        importState === 'imported'
          ? `${listCount ?? 0} lists, ${segmentCount ?? 0} segments`
          : importState
            ? importState.charAt(0).toUpperCase() + importState.slice(1)
            : 'Not yet imported',
    }),
  },
})
