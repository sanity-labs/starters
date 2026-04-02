import {defineBlueprint, defineDocumentFunction} from '@sanity/blueprints'

export default defineBlueprint({
  resources: [
    defineDocumentFunction({
      name: 'sync-list',
      src: 'functions/dist/sync-list',
      event: {
        on: ['update'],
        filter: '_type == "list" && syncState == "requested"',
        projection: '{_id, name, syncState}',
      },
    }),
    defineDocumentFunction({
      name: 'sync-audience',
      src: 'functions/dist/sync-audience',
      event: {
        on: ['update'],
        filter: '_type == "audience" && syncState == "requested"',
        projection: '{_id, name, syncState}',
      },
    }),
    defineDocumentFunction({
      name: 'send-email',
      src: 'functions/dist/send-email',
      event: {
        on: ['update'],
        filter: '_type == "emailMessage" && sendState == "requested"',
        projection: '{_id, title, subject, sendState}',
      },
    }),
  ],
})
