/**
 * Shared plumbing for the three effect handlers: client narrowing, effect
 * parameter narrowing, GDR arithmetic, and the at-least-once idempotency read.
 *
 * Engine-and-stdlib only, like `src/workflows/` — a handler runs inside a
 * Sanity Function, so nothing here may drag React or Studio internals in.
 */

import type {SanityClient} from '@sanity/client'
import type {
  EffectHandler,
  GdrUri,
  ReleaseRef,
  WorkflowClient,
  WorkflowPerspective,
} from '@sanity/workflow-engine'

import {DEFAULT_CONTENT_PERSPECTIVE, gdrUri, parseGdr} from '@sanity/workflow-engine'

/** The engine's handler context. Only reachable through the handler signature. */
export type EffectContext = Parameters<EffectHandler>[1]

/**
 * Agent Actions are served by the unversioned API while content reads and
 * writes run against a dated one. The Function this replaces built two clients
 * from `context.clientOptions`; a handler is handed a client instead, so the
 * agent one is derived from it.
 */
export const AGENT_API_VERSION = 'vX'

/**
 * The `@sanity/client` surface the engine's minimal `WorkflowClient` does not
 * declare but a real one has. `clientFor` returns the narrow interface; these
 * are the members the handlers reach for beyond it.
 *
 * `request` widens the engine's option bag with `json`, which the History API
 * needs: its transaction log is newline-delimited JSON and the default parse
 * chokes on it.
 */
export interface ContentClient extends WorkflowClient {
  action: NonNullable<WorkflowClient['action']>
  agent: SanityClient['agent']
  createIfNotExists: SanityClient['createIfNotExists']
  createOrReplace: SanityClient['createOrReplace']
  patch: SanityClient['patch']
  transaction: SanityClient['transaction']
  request: <T>(opts: {
    url?: string
    uri?: string
    signal?: AbortSignal
    tag?: string
    json?: boolean
  }) => Promise<T>
}

function isContentClient(client: WorkflowClient): client is ContentClient {
  return (
    typeof client.action === 'function' &&
    typeof client.request === 'function' &&
    typeof client.withConfig === 'function' &&
    'agent' in client &&
    'createIfNotExists' in client &&
    'createOrReplace' in client
  )
}

/**
 * Route to the resource a document actually lives in. `ctx.client` addresses
 * the workflows dataset only — content reads and writes must go through here or
 * they land in the wrong place.
 */
export function contentClientFor(ctx: EffectContext, ref: GdrUri): ContentClient {
  const client = ctx.clientFor(ref)
  if (!isContentClient(client)) {
    throw new Error(`No content client available for ${ref}`)
  }
  return client
}

/** A sibling bound to the Agent Actions API version, tagged with the effect key. */
export function agentClient(client: ContentClient, ctx: EffectContext): ContentClient {
  const derived = client.withConfig?.({
    apiVersion: AGENT_API_VERSION,
    requestTagPrefix: `l10n.${requestTagSegment(ctx.effectKey)}`,
  })
  if (!derived) {
    throw new Error('Content client cannot be rebound to the agent API version')
  }
  return derived
}

/** Request tags accept `[A-Za-z0-9._-]`; an effect key is not guaranteed to. */
export function requestTagSegment(effectKey: string): string {
  return effectKey.replace(/[^A-Za-z0-9_-]/g, '-')
}

export function isGdrUri(value: string): value is GdrUri {
  try {
    parseGdr(value)
    return true
  } catch {
    return false
  }
}

/** An effect binding that resolves to a document reference, as a GDR. */
export function requireGdr(params: Record<string, unknown>, name: string): GdrUri {
  const value = params[name]
  if (typeof value !== 'string' || !isGdrUri(value)) {
    throw new Error(`Effect param "${name}" must be a GDR URI, got ${JSON.stringify(value)}`)
  }
  return value
}

export function requireString(params: Record<string, unknown>, name: string): string {
  const value = params[name]
  if (typeof value !== 'string' || !value) {
    throw new Error(`Effect param "${name}" must be a non-empty string`)
  }
  return value
}

export function optionalString(params: Record<string, unknown>, name: string): null | string {
  const value = params[name]
  return typeof value === 'string' && value ? value : null
}

/** A `release.ref` binding — the envelope, not a bare name. Null when unbound. */
export function optionalRelease(params: Record<string, unknown>, name: string): null | ReleaseRef {
  const value = params[name]
  if (typeof value !== 'object' || value === null) return null
  if (!('id' in value) || typeof value.id !== 'string' || !isGdrUri(value.id)) return null
  if (!('releaseName' in value) || typeof value.releaseName !== 'string') return null
  return {id: value.id, type: 'system.release', releaseName: value.releaseName}
}

/** Another document in the same resource as `reference`. */
export function siblingGdr(reference: GdrUri, documentId: string): GdrUri {
  const parsed = parseGdr(reference)
  if (parsed.scheme === 'dataset') {
    if (!parsed.projectId || !parsed.dataset) {
      throw new Error(`GDR ${reference} is missing its project/dataset parts`)
    }
    return gdrUri({
      scheme: 'dataset',
      projectId: parsed.projectId,
      dataset: parsed.dataset,
      documentId,
    })
  }
  if (!parsed.resourceId) {
    throw new Error(`GDR ${reference} is missing its resource id`)
  }
  return gdrUri({scheme: parsed.scheme, resourceId: parsed.resourceId, documentId})
}

/** The dataset a `dataset:` GDR addresses — the History API takes it in the path. */
export function datasetOf(reference: GdrUri): string {
  const parsed = parseGdr(reference)
  if (parsed.scheme !== 'dataset' || !parsed.dataset) {
    throw new Error(`GDR ${reference} does not address a dataset`)
  }
  return parsed.dataset
}

/**
 * The subject as the engine sees it.
 *
 * Not a detail: the `source-changed` trigger compares `$fields.subject._rev`
 * with the `analyzedRev` this read produces, and the engine hydrates content
 * under `instance.perspective ?? DEFAULT_CONTENT_PERSPECTIVE`. A handler
 * reading a different layer would record a revision the trigger can never
 * match, and the run would report drift on every tick.
 *
 * Field-tier runs start under a `published` perspective precisely so their own
 * draft writes stay invisible here (see `startPerspectiveFor`).
 */
export async function readSubjectDocument(
  client: ContentClient,
  ctx: EffectContext,
  publishedId: string,
): Promise<null | Record<string, unknown>> {
  return client.fetch<null | Record<string, unknown>>(
    `*[_id == $id][0]`,
    {id: publishedId},
    {perspective: await instancePerspective(ctx), tag: 'get-source-doc'},
  )
}

/** The read perspective this run was started with, or the engine's default. */
export async function instancePerspective(ctx: EffectContext): Promise<WorkflowPerspective> {
  const value = await ctx.client.fetch<unknown>(
    `*[_id == $instanceId][0].perspective`,
    {instanceId: ctx.instanceId},
    {tag: 'read-perspective'},
  )
  return isPerspective(value) ? value : DEFAULT_CONTENT_PERSPECTIVE
}

function isPerspective(value: unknown): value is WorkflowPerspective {
  if (Array.isArray(value)) return value.every((entry) => typeof entry === 'string')
  return value === 'raw' || value === 'published' || value === 'drafts'
}

/**
 * Effect delivery is at-least-once: a dispatch that completed its side effect
 * but died before `completeEffect`, or one that outlived its lease, comes back
 * under the same `ctx.effectKey`. A handler about to spend an AI call or write
 * a document checks the ledger first.
 */
export async function effectAlreadyDone(ctx: EffectContext): Promise<boolean> {
  const settled = await ctx.client.fetch<null | string[]>(
    `*[_id == $instanceId][0].effectHistory[status == "done"]._key`,
    {instanceId: ctx.instanceId},
    {tag: 'effect-idempotency'},
  )
  return settled?.includes(ctx.effectKey) ?? false
}
