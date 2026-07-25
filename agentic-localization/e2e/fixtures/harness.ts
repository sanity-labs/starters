/**
 * One harness per feature file: a run tag, the definitions deployed under it,
 * an engine to read and drive with, and the cleanup that unwinds all of it.
 *
 * Two drive modes, both against the real engine and the real Content Lake:
 *
 *  - **P** — no handlers. The harness plays them, completing each pending
 *    effect with the ops a real handler would write. Proves the definitions,
 *    the guards, the cohort gates and the Functions, spends nothing.
 *  - **H** — the real `localizationEffectHandlers`, with only the two Agent
 *    Actions canned. Proves the write paths: what lands in the lake, at which
 *    revision, and which documents are NOT created.
 */

import type {SanityClient} from '@sanity/client'
import type {
  Engine,
  FieldOp,
  GdrUri,
  PendingEffect,
  WorkflowInstance,
} from '@sanity/workflow-engine'
import type {AgentStub} from './agentStub'

import {randomBytes} from 'node:crypto'

import {
  createEngine,
  EXECUTION_KINDS,
  gdrUri,
  tagScopeFilter,
  WORKFLOW_INSTANCE_TYPE,
} from '@sanity/workflow-engine'
import {localizationEffectHandlers} from '@starter/l10n/effects'
import {localizationWorkflows} from '@starter/l10n/workflows'

import {createAgentStub} from './agentStub'
import {contentClient, workflowsClient} from './clients'
import {
  assertE2eCredentials,
  CONTENT_DATASET,
  resourceId,
  RUN_PREFIX,
  WORKFLOWS_DATASET,
} from './env'

/** Above the 120s Function timeout, matching `functions/engine.ts`. */
const EFFECT_LEASE_MS = 150_000

/** The engine's reader-model acknowledgement, matching `sanity.workflow.ts`. */
const EXPECTED_MIN_READER_MODEL = 4

/** A drain pass that has not settled by here is a hang, not slow I/O. */
const MAX_DRAIN_PASSES = 12

export type DriveMode = 'P' | 'H'

export interface CompleteEffectArgs {
  instanceId: string
  effect: string
  status?: 'done' | 'failed'
  ops?: FieldOp[]
}

export interface Harness {
  readonly projectId: string
  readonly content: SanityClient
  /**
   * The content client with its Agent Actions canned — what the engine hands the
   * effect handlers, and what a Function under test has to be given instead of
   * building its own, or the journey spends real AI.
   */
  readonly cannedContent: SanityClient
  readonly engine: Engine
  readonly agent: AgentStub

  /** Deploy the definitions under this run's tag. Call once, from `beforeAll`. */
  deploy(): Promise<void>
  /** Abort what is in flight and delete everything this run created. */
  dispose(): Promise<void>

  /** A fresh document id, registered for cleanup. */
  newId(name: string): string

  /** The root runs whose subject is `publishedId`, oldest first. */
  runsFor(publishedId: string): Promise<WorkflowInstance[]>
  /** The single root run for `publishedId`; throws when there is not exactly one. */
  runFor(publishedId: string): Promise<WorkflowInstance>

  pendingEffects(instanceId: string): Promise<PendingEffect[]>
  /** Play an external handler reporting its result (mode P). */
  complete(args: CompleteEffectArgs): Promise<void>
  /** Dispatch pending effects through the real handlers, then advance (mode H). */
  drain(instanceId: string): Promise<void>
  /** `drain` over the run and its children until nothing is pending anywhere. */
  drainRun(instanceId: string): Promise<void>

  /** Abort in-flight instances and delete this scenario's documents. */
  resetScenario(): Promise<void>
}

export function createHarness(mode: DriveMode): Harness {
  const {projectId} = assertE2eCredentials()
  const runId = randomBytes(4).toString('hex')
  const tag = `e2e-${runId}`
  const prefix = `${RUN_PREFIX}${runId}-`

  // The runtime Functions read these with `requireEnv` at call time, so setting
  // them here — before any handler is invoked — points them at this run.
  process.env.WORKFLOW_TAG = tag
  process.env.WORKFLOWS_DATASET_ID = resourceId(projectId, WORKFLOWS_DATASET)
  process.env.WORKFLOWS_DATASET_NAME = WORKFLOWS_DATASET
  // `distill-review` is triggered by the workflows dataset and reaches the other
  // way, so it is the one Function that has to be told where content lives.
  process.env.CONTENT_DATASET_NAME = CONTENT_DATASET

  const content = contentClient()
  const workflows = workflowsClient()
  const agent = createAgentStub({
    promptResponse: cannedPrompt,
    translate: (value, locale) => `[${locale}] ${value}`,
  })
  const cannedContent = agent.wrap(content)

  const engine = createEngine({
    client: workflows,
    tag,
    workflowResource: {type: 'dataset', id: resourceId(projectId, WORKFLOWS_DATASET)},
    effectHandlers: mode === 'H' ? localizationEffectHandlers : {},
    effectLeaseMs: EFFECT_LEASE_MS,
    missingHandler: 'skip',
    executionContext: {kind: EXECUTION_KINDS.test, id: 'e2e'},
    // Content traffic routes here, so a handler's reads and writes are real and
    // only its Agent Actions are canned. The engine would otherwise derive an
    // un-canned sibling from the workflows client's credentials.
    resourceClients: (parsed) => (parsed.dataset === CONTENT_DATASET ? cannedContent : undefined),
  })

  const created = new Set<string>()
  let sequence = 0

  function subjectGdr(publishedId: string): GdrUri {
    return gdrUri({scheme: 'dataset', projectId, dataset: CONTENT_DATASET, documentId: publishedId})
  }

  /**
   * The run tag is per-file and every scenario mints a fresh document, so
   * filtering on the subject GDR is what keeps one scenario's assertions off
   * another's instances. Filtered in GROQ rather than in memory: a feature's
   * instances accumulate, and hydrating all of them per step is quadratic.
   */
  async function runsFor(publishedId: string): Promise<WorkflowInstance[]> {
    const rows = await engine.query<{_id: string; startedAt?: string}[]>({
      groq:
        `*[_type == "${WORKFLOW_INSTANCE_TYPE}" && ${tagScopeFilter()} ` +
        `&& count(coalesce(ancestors, [])) == 0 ` +
        `&& count(fields[name == "subject" && value.id == $subject]) > 0]{_id, startedAt}`,
      params: {subject: subjectGdr(publishedId)},
    })
    const ordered = [...rows].sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''))
    return Promise.all(ordered.map((row) => engine.getInstance({instanceId: row._id})))
  }

  async function pendingEffects(instanceId: string): Promise<PendingEffect[]> {
    return engine.listPendingEffects({instanceId})
  }

  async function complete(args: CompleteEffectArgs): Promise<void> {
    const pending = await pendingEffects(args.instanceId)
    const effect = pending.find((entry) => entry.name === args.effect)
    if (!effect) {
      throw new Error(
        `[e2e] no pending "${args.effect}" on ${args.instanceId} — pending: ` +
          `${pending.map((entry) => entry.name).join(', ') || '(none)'}`,
      )
    }
    await engine.completeEffect({
      instanceId: args.instanceId,
      effectKey: effect._key,
      status: args.status ?? 'done',
      ...(args.status !== 'failed' && args.ops ? {ops: args.ops} : {}),
    })
  }

  async function drain(instanceId: string): Promise<void> {
    const {failed} = await engine.drainEffects({instanceId})
    for (const effect of failed) {
      console.log(
        `[e2e] effect "${effect.name}" failed on ${instanceId} (expected in some journeys)`,
      )
    }
    await engine.tick({instanceId})
  }

  async function drainRun(instanceId: string): Promise<void> {
    for (let pass = 0; pass < MAX_DRAIN_PASSES; pass += 1) {
      const targets = [instanceId, ...(await engine.children({instanceId})).map((c) => c._id)]
      let dispatched = false
      for (const target of targets) {
        if ((await pendingEffects(target)).length === 0) continue
        await drain(target)
        dispatched = true
      }
      // A child's completion is what lets the parent's cohort gate resolve.
      await engine.tick({instanceId})
      if (!dispatched) return
    }
    throw new Error(
      `[e2e] ${instanceId} still had pending effects after ${MAX_DRAIN_PASSES} passes`,
    )
  }

  /**
   * Abort what is still in flight, so its lake guards are retracted before the
   * next scenario publishes anything. Parents first: an abort cascades to its
   * children, so aborting a child first is wasted work.
   */
  async function abortInFlight(): Promise<void> {
    const ids = await engine.query<string[]>({
      groq:
        `*[_type == "${WORKFLOW_INSTANCE_TYPE}" && ${tagScopeFilter()} ` +
        `&& !defined(completedAt)] | order(count(coalesce(ancestors, [])) asc)._id`,
    })
    for (const instanceId of ids) {
      await engine.abortInstance({
        instanceId,
        reason: 'e2e cleanup',
        idempotencyKey: `e2e-cleanup:${instanceId}`,
      })
    }
  }

  async function deleteRunContent(): Promise<void> {
    // The join document a document-tier translation registers is keyed off the
    // source id, so its prefix sits one level in rather than at the front.
    await content.delete({
      query:
        '*[string::startsWith(_id, $doc) || string::startsWith(_id, $draft) || string::startsWith(_id, $metadata)]',
      params: {
        doc: prefix,
        draft: `drafts.${prefix}`,
        metadata: `translation.metadata.${prefix}`,
      },
    })
  }

  return {
    projectId,
    content,
    cannedContent,
    engine,
    agent,

    async deploy() {
      await engine.deployDefinitions({
        expectedMinReaderModel: EXPECTED_MIN_READER_MODEL,
        definitions: localizationWorkflows,
      })
      // The one line that makes a failed run diagnosable: everything this file
      // wrote is under this tag and this id prefix.
      console.log(`[e2e] mode ${mode}: tag ${tag}, ids ${prefix}*`)
    },

    async dispose() {
      await abortInFlight()
      // Instances, definitions and the run's whole tag partition.
      await workflows.delete({query: `*[${tagScopeFilter()}]`, params: {tag}})
      await deleteRunContent()
    },

    newId(name) {
      sequence += 1
      const id = `${prefix}${name}-${sequence}`
      created.add(id)
      return id
    },

    runsFor,

    async runFor(publishedId) {
      const runs = await runsFor(publishedId)
      if (runs.length !== 1) {
        throw new Error(`[e2e] expected exactly one run for ${publishedId}, found ${runs.length}`)
      }
      return runs[0]
    },

    pendingEffects,
    complete,
    drain,
    drainRun,

    async resetScenario() {
      await abortInFlight()
      agent.reset()
      if (created.size > 0) {
        const ids = [...created].flatMap((id) => [id, `drafts.${id}`, `translation.metadata.${id}`])
        created.clear()
        await content.delete({query: '*[_id in $ids]', params: {ids}})
      }
    },
  }
}

/** Read a resolved workflow-scope field off an instance document. */
export function fieldValue(instance: WorkflowInstance, name: string): unknown {
  return instance.fields.find((field) => field.name === name)?.value
}

/**
 * What the analysis prompt answers when a journey reaches it. The handler only
 * keeps suggestions naming a field that actually changed, so the field name
 * here matches the fixtures' one editable body field.
 */
const CANNED_ANALYSIS = {
  materiality: 'material',
  explanation: 'The body copy changed in a way that affects every translated market.',
  suggestions: [
    {
      fieldName: 'body',
      recommendation: 'retranslate',
      explanation: 'The body was rewritten.',
      changeSummary: 'Body rewritten.',
    },
  ],
}

/**
 * What the distillation prompt answers.
 *
 * Both halves are quoted from the field-tier fixture on purpose: the handler
 * drops any term that is not verbatim in the source and any translation that is
 * not verbatim in what the reviewer approved, so a canned answer that cheated
 * would be discarded and the journey would prove nothing.
 */
const CANNED_DISTILLATION = {
  proposals: [
    {
      kind: 'glossary-term',
      locale: 'de-DE',
      term: 'algorithm',
      translation: 'Algorithmus',
      fieldPath: 'bio',
      rationale: 'The reviewer used the German product term.',
    },
  ],
}

/**
 * Which canned answer a prompt call gets.
 *
 * Two callers share `agent.action.prompt`, and the marker is the distillation
 * instruction's own heading rather than a flag the harness sets — a journey that
 * reaches the loop should not have to arm it first.
 */
function cannedPrompt(params: Record<string, unknown>): string {
  const instruction = typeof params.instruction === 'string' ? params.instruction : ''
  return JSON.stringify(
    instruction.includes('Corrections, per locale:') ? CANNED_DISTILLATION : CANNED_ANALYSIS,
  )
}
