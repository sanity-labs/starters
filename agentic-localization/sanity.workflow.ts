import {defineWorkflowConfig} from '@sanity/workflow-engine/define'
import {localizationWorkflows, WORKFLOW_TAG, WORKFLOWS_DATASET} from '@starter/l10n/workflows'

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

export default defineWorkflowConfig({
  deployments: [
    {
      name: 'localization',
      tag: WORKFLOW_TAG,
      // Every @sanity/workflow-* package here is >= 0.23.0 (reader model 4).
      // Bump only after upgrading every reader: Studio, Functions, CLI, apps.
      expectedMinReaderModel: 4,
      // Engine storage is a dedicated dataset; content lives in the main one.
      workflowResource: {type: 'dataset', id: `${projectId}.${WORKFLOWS_DATASET}`},
      // All three definitions deploy as one set: a parent cannot spawn a
      // child that is not deployed.
      definitions: localizationWorkflows,
    },
  ],
})
