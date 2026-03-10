import {defineBlueprint, defineDocumentFunction} from '@sanity/blueprints'

export default defineBlueprint({
  resources: [
    defineDocumentFunction({
      name: 'hello-world',
      event: {
        on: ['create', 'update'],
        filter: '_type == "post"',
        projection: '{_id, title}',
      },
    }),
  ],
})
