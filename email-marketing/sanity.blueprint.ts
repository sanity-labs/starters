import {defineBlueprint, defineDocumentFunction} from '@sanity/blueprints'

export default defineBlueprint({
  resources: [
    defineDocumentFunction({
      name: 'import-klaviyo',
      src: 'functions/dist/import-klaviyo',
      event: {
        on: ['update'],
        filter: '_type == "klaviyoImport" && importState == "requested"',
        projection: '{_id, importState}',
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
