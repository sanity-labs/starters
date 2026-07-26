import {
  defineBlueprint,
  defineCorsOrigin,
  defineDataset,
  defineDocumentFunction,
  defineRobotToken,
} from '@sanity/blueprints'
import {
  APPROVED_STAGE,
  localizeDocument,
  SOURCE_LANGUAGE,
  WORKFLOW_TAG,
  WORKFLOWS_DATASET,
} from '@starter/l10n/workflows'

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

const workflowsDatasetId = `${projectId}.${WORKFLOWS_DATASET}`

/** What a Function needs to reach the engine's store from a content event. */
const workflowsEnv = {
  WORKFLOW_TAG,
  WORKFLOWS_DATASET_ID: workflowsDatasetId,
  WORKFLOWS_DATASET_NAME: WORKFLOWS_DATASET,
}

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

    // Editorial Workflows engine storage. Workflow instances live here;
    // content documents stay in the main dataset. Definitions deploy into it
    // via `sanity-workflows deploy` (see sanity.workflow.ts). No attach: the
    // main dataset pre-exists from `sanity init`, but this one is created and
    // owned by the stack.
    defineDataset({
      name: 'workflows-dataset',
      datasetName: WORKFLOWS_DATASET,
      aclMode: 'private',
      lifecycle: {
        deletionPolicy: 'retain',
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

    // Frontend dev server — Sanity Live opens a browser connection to the Live
    // Content API, so the origin has to be allowed even for published content.
    defineCorsOrigin({
      name: 'frontend-dev',
      origin: 'http://localhost:3000',
      allowCredentials: true,
    }),

    // ── Robot Token ──────────────────────────────────────────────────
    defineRobotToken({
      name: 'fn-robot',
      label: 'Translation Functions',
      memberships: [{resourceType: 'project', resourceId: projectId, roleNames: ['editor']}],
    }),

    // ── Runtime Functions ────────────────────────────────────────────
    // The engine has no runtime of its own: these four are it. Effect handlers
    // live in `@starter/l10n/effects`; the definitions they satisfy in
    // `@starter/l10n/workflows`.

    // Dispatches an instance's pending effects, then advances it. The filter
    // cuts the self-trigger churn from the drainer's own completion writes.
    defineDocumentFunction({
      name: 'drain-effects',
      src: 'functions/dist/drain-effects',
      robotToken: '$.resources.fn-robot.token',
      event: {
        on: ['create', 'update'],
        filter: "_type == 'sanity.workflow.instance' && count(pendingEffects) > 0",
        projection: '{_id, _type}',
        resource: {type: 'dataset', id: workflowsDatasetId},
      },
      env: {WORKFLOW_TAG, WORKFLOWS_DATASET_ID: workflowsDatasetId},
      timeout: 120,
      memory: 1,
    }),

    // Publishing a source document starts a run, or ticks the open one so its
    // `sourceChanged` trigger sees the new revision.
    defineDocumentFunction({
      name: 'start-localization',
      src: 'functions/dist/start-localization',
      robotToken: '$.resources.fn-robot.token',
      event: {
        on: ['publish'],
        // A field-tier type has no language field — its locales live in
        // internationalized arrays — so only the document tier is filtered
        // down to its source language.
        filter: `(_type == 'article' && language == '${SOURCE_LANGUAGE}') || _type == 'person'`,
        projection: '{_id, _rev, _type, language}',
        resource: {type: 'dataset', id: `${projectId}.${datasetName}`},
      },
      env: workflowsEnv,
      timeout: 30,
    }),

    // The learning loop: an approved run's corrections become DRAFT proposals.
    // Triggered by the instance rather than by content, so `clientOptions`
    // already points at the workflows dataset and the CONTENT dataset — where
    // the claim, the proposals and the text all live — is named in the env.
    defineDocumentFunction({
      name: 'distill-review',
      src: 'functions/dist/distill-review',
      robotToken: '$.resources.fn-robot.token',
      event: {
        on: ['update'],
        // `APPROVED_STAGE` is interpolated so the filter cannot drift from the
        // deployed definition — `distillTrigger.test.ts` bench-proves that
        // `approved` is a real terminal stage of it.
        filter:
          `_type == 'sanity.workflow.instance' && definition == '${localizeDocument.name}' ` +
          `&& currentStage == '${APPROVED_STAGE}'`,
        projection: '{_id, _type, definition, currentStage}',
        resource: {type: 'dataset', id: workflowsDatasetId},
      },
      env: {...workflowsEnv, CONTENT_DATASET_NAME: datasetName},
      // One AI call for the whole run, plus a History read per locale.
      timeout: 120,
      memory: 1,
    }),

    // A deleted source leaves its run parked in review, holding a publish
    // guard on a document that no longer exists.
    defineDocumentFunction({
      name: 'handle-deleted-subject',
      src: 'functions/dist/handle-deleted-subject',
      robotToken: '$.resources.fn-robot.token',
      event: {
        on: ['delete'],
        filter: "_type in ['article', 'person']",
        projection: '{_id, _type}',
        resource: {type: 'dataset', id: `${projectId}.${datasetName}`},
      },
      env: workflowsEnv,
      timeout: 30,
    }),

    // Opt-in: scheduled Functions deploy only to organization-scoped stacks
    // (`sanity blueprints promote`), and `sanity init` creates project-scoped
    // ones. The pipeline runs without it — start-localization ticks on every
    // publish — this sweep only speeds up recovery of orphaned effect claims.
    // To enable: promote the stack, re-add defineScheduleFunction to the
    // imports, and uncomment.
    // defineScheduleFunction({
    //   name: 'heartbeat',
    //   src: 'functions/dist/heartbeat',
    //   robotToken: '$.resources.fn-robot.token',
    //   event: {minute: '*/15', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*'},
    //   env: {...workflowsEnv, SANITY_PROJECT_ID: projectId},
    //   timeout: 60,
    // }),
  ],
})
