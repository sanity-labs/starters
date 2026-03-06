import {
  defineBlueprint,
  defineCorsOrigin,
  defineDataset,
  defineDocumentFunction,
  defineRobotToken,
} from '@sanity/blueprints'

// Load env — jiti (which loads this file) doesn't support process.loadEnvFile,
// so we parse .env manually. import.meta.dirname is synthesized by jiti.
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'

try {
  const envFile = resolve(import.meta.dirname ?? process.cwd(), '.env')
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
      process.env[match[1].trim()] ??= value
    }
  }
} catch {}

const projectId = process.env.SANITY_STUDIO_PROJECT_ID!
const datasetName =
  process.env.BLUEPRINT_DATASET ?? process.env.SANITY_STUDIO_DATASET ?? 'production'

export default defineBlueprint({
  resources: [
    // ── Dataset ──────────────────────────────────────────────────────
    defineDataset({
      name: 'dataset',
      datasetName,
      aclMode: 'private',
      lifecycle: {
        deletionPolicy: 'retain',
        ownershipAction: {type: 'attach', id: datasetName, projectId},
      },
    }),

    // ── CORS ────────────────────────────────────────────────────────
    // TODO: attach the Studio dev-server CORS origin (http://localhost:3333)
    // once the blueprints backend supports colons in ownershipAction.id.
    // `sanity init` creates this origin — attaching it would let the stack
    // manage it without a duplicate-origin conflict on redeploy.

    // Dashboard dev server
    defineCorsOrigin({
      name: 'dashboard-dev',
      origin: 'http://localhost:3334',
      allowCredentials: true,
    }),

    // ── Robot Token ──────────────────────────────────────────────────
    defineRobotToken({
      name: 'fn-robot',
      label: 'Translation Functions',
      memberships: [{resourceType: 'project', resourceId: projectId, roleNames: ['editor']}],
    }),

    // ── Document Functions ───────────────────────────────────────────
    defineDocumentFunction({
      name: 'mark-translations-stale',
      src: 'functions/dist/mark-translations-stale',
      robotToken: '$.resources.fn-robot',
      event: {
        on: ['publish'],
        filter: "_type == 'article' && language == 'en-US'",
        projection: '{_id, _rev, _type, language}',
        resource: {type: 'dataset', id: `${projectId}.${datasetName}`},
      },
      timeout: 15,
    }),
    defineDocumentFunction({
      name: 'analyze-stale-translations',
      src: 'functions/dist/analyze-stale-translations',
      robotToken: '$.resources.fn-robot',
      event: {
        on: ['update'],
        filter: "_type == 'translation.metadata' && count(workflowStates[status == 'stale']) > 0",
        projection: '{_id, _rev, _type}',
        resource: {type: 'dataset', id: `${projectId}.${datasetName}`},
      },
      timeout: 120,
      memory: 1,
    }),
  ],
})
