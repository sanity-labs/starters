import {defineBlueprint, defineDocumentFunction} from '@sanity/blueprints'

// Load env — jiti (which loads this file) doesn't support process.loadEnvFile,
// so we parse studio/.env manually. import.meta.dirname is synthesized by jiti.
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'

try {
  const envFile = resolve(import.meta.dirname ?? process.cwd(), 'studio/.env')
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
      process.env[match[1].trim()] ??= value
    }
  }
} catch {}

const {SANITY_STUDIO_PROJECT_ID, SANITY_STUDIO_DATASET} = process.env

if (!SANITY_STUDIO_PROJECT_ID || !SANITY_STUDIO_DATASET) {
  throw new Error(
    'Missing required env vars for blueprint deploy: SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET must be set in studio/.env',
  )
}

export default defineBlueprint({
  resources: [
    defineDocumentFunction({
      name: 'set-review-date',
      src: 'functions/dist/set-review-date',
      event: {
        on: ['create', 'update'],
        // Policy review clocks are content governance, upstream of any Knowledge
        // Base. Skip docs that already have a date so the patch does not re-fire.
        filter: '_type == "policy" && !defined(reviewByDate)',
        projection: '{_id, _type}',
      },
    }),
  ],
})
