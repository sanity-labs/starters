/**
 * Canned Agent Actions.
 *
 * Mode H runs the real effect handlers — the real prompt assembly, the real
 * GDR arithmetic, the real Content Lake writes — with only the two AI calls
 * replaced. Everything else about the run is production code.
 *
 * The seam is a recursive proxy rather than a hand-built fake client: the
 * engine derives siblings from the client it is given (`withConfig` onto its
 * own API version, and `agentClient` onto `vX`), so a wrapper that does not
 * survive `withConfig` is bypassed on the first derivation.
 */

import type {SanityClient} from '@sanity/client'

export interface AgentCall {
  action: 'prompt' | 'translate'
  params: Record<string, unknown>
}

export interface AgentStub {
  /** Every canned call, in order. `length === 0` is the zero-AI assertion. */
  readonly calls: AgentCall[]
  /** Forget the recorded calls. Scenarios share one racejar context object. */
  reset(): void
  /** A client whose `agent` namespace — and every client derived from it — is canned. */
  wrap(client: SanityClient): SanityClient
}

export interface AgentStubOptions {
  /**
   * What `agent.action.prompt` answers, given the call's parameters.
   *
   * Two callers share this action — the analysis and the distillation — and both
   * parse the answer as JSON of their own shape, so the canned answer has to be
   * chosen from the instruction rather than fixed per harness.
   */
  promptResponse: (params: Record<string, unknown>) => string
  /** How a source value reads once "translated". */
  translate: (value: string, locale: string) => string
}

export function createAgentStub(options: AgentStubOptions): AgentStub {
  const calls: AgentCall[] = []

  function agentFor(client: SanityClient) {
    return {
      action: {
        prompt: async (params: Record<string, unknown>) => {
          calls.push({action: 'prompt', params})
          return options.promptResponse(params)
        },
        translate: async (params: Record<string, unknown>) => {
          calls.push({action: 'translate', params})
          return cannedTranslation(client, params, options.translate)
        },
      },
    }
  }

  function wrap(client: SanityClient): SanityClient {
    return new Proxy(client, {
      get(target, property) {
        if (property === 'agent') return agentFor(target)

        // Receiver is the target, not the proxy: `SanityClient` reads private
        // fields in its getters and a proxy receiver fails the brand check.
        const value = Reflect.get(target, property, target)
        if (typeof value !== 'function') return value
        // Every client the engine or a handler derives has to stay canned.
        if (property === 'withConfig') {
          return (config: unknown) => wrap(Reflect.apply(value, target, [config]))
        }
        return value.bind(target)
      },
    })
  }

  return {
    calls,
    reset: () => calls.splice(0, calls.length),
    wrap,
  }
}

/**
 * The field-tier answer: the source document with the values at the requested
 * target paths replaced. That is what the live API returns under
 * `noWrite: true` — the paths name the SOURCE entries, so the handler reads the
 * translated values back at the same keys.
 */
async function cannedTranslation(
  client: SanityClient,
  params: Record<string, unknown>,
  translate: (value: string, locale: string) => string,
): Promise<Record<string, unknown>> {
  const targets = params.target
  if (!Array.isArray(targets)) {
    throw new Error(
      '[e2e] the agent stub only cans field-tier translate calls (the ones carrying `target`). ' +
        'A document-tier journey needs its own canned answer — see e2e/README.md.',
    )
  }

  const documentId = params.documentId
  if (typeof documentId !== 'string') {
    throw new Error('[e2e] translate call carried no documentId')
  }

  const locale = localeOf(params.toLanguage)
  const source = await client.fetch<null | Record<string, unknown>>(
    '*[_id == $id][0]',
    {id: documentId},
    // A literal draft or version id is never matched by a resolving perspective.
    {perspective: 'raw', tag: 'stub-read-source'},
  )
  if (!source)
    throw new Error(`[e2e] translate call named a document that does not exist: ${documentId}`)

  const document = structuredClone(source)
  for (const target of targets) {
    if (!isRecord(target) || !Array.isArray(target.path)) {
      throw new Error(`[e2e] malformed translate target: ${JSON.stringify(target)}`)
    }
    mapAtPath(document, target.path, (value) => {
      if (typeof value !== 'string') {
        throw new Error(
          `[e2e] the stub only translates strings; ${JSON.stringify(target.path)} holds ${typeof value}`,
        )
      }
      return translate(value, locale)
    })
  }
  return document
}

function localeOf(toLanguage: unknown): string {
  if (isRecord(toLanguage) && typeof toLanguage.id === 'string') return toLanguage.id
  throw new Error(`[e2e] translate call carried no toLanguage.id: ${JSON.stringify(toLanguage)}`)
}

/**
 * Replace the value at one Agent Actions target path. Segments are field names
 * or `{_key}` array selectors — the shape `translateLocale` builds.
 */
function mapAtPath(root: unknown, path: unknown[], map: (value: unknown) => unknown): void {
  const last = path.length - 1
  let node: unknown = root
  for (const [index, segment] of path.entries()) {
    const container = resolve(node, segment)
    if (index === last) {
      write(node, segment, map(container))
      return
    }
    node = container
  }
}

function resolve(node: unknown, segment: unknown): unknown {
  if (typeof segment === 'string') {
    if (!isRecord(node)) throw new Error(`[e2e] cannot read "${segment}" off ${typeof node}`)
    return node[segment]
  }
  if (isRecord(segment) && typeof segment._key === 'string') {
    if (!Array.isArray(node)) throw new Error('[e2e] a _key segment needs an array')
    return node.find((entry) => isRecord(entry) && entry._key === segment._key)
  }
  throw new Error(`[e2e] unsupported path segment: ${JSON.stringify(segment)}`)
}

function write(node: unknown, segment: unknown, value: unknown): void {
  if (typeof segment === 'string' && isRecord(node)) {
    node[segment] = value
    return
  }
  throw new Error(`[e2e] cannot write through path segment ${JSON.stringify(segment)}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
