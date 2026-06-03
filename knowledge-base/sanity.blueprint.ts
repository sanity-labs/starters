import {defineBlueprint, defineDocumentFunction} from '@sanity/blueprints'

export default defineBlueprint({
  resources: [
    defineDocumentFunction({
      name: 'set-review-date',
      src: 'functions/dist/set-review-date',
      event: {
        on: ['create', 'update'],
        // Scope to reviewable content and skip docs that already have a clock —
        // this also stops the function's own patch from re-triggering it.
        filter: '_type in ["helpArticle", "faq", "playbook", "policy"] && !defined(reviewByDate)',
        projection: '{_id, _type}',
      },
    }),
  ],
})
