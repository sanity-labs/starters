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
      name: 'on-promotion-approved',
      src: 'functions/dist/on-promotion-approved',
      timeout: 60,
      event: {
        on: ['create', 'update'],
        filter: '_type == "workflow.state" && status == "approved"',
        projection: '{_id, status, promotionId}',
      },
    }),
  ],
})
