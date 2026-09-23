import {createMCPClient} from '@ai-sdk/mcp'
import type {ToolSet} from 'ai'

export type Surface = 'support' | 'ops'

export function mcpUrls(surface: Surface) {
  if (surface === 'support') {
    return {
      groq: process.env.SANITY_MCP_SUPPORT_GROQ_URL,
      kb: process.env.SANITY_MCP_SUPPORT_KB_URL,
    }
  }
  return {
    groq: process.env.SANITY_MCP_OPS_GROQ_URL,
    kb: process.env.SANITY_MCP_OPS_KB_URL,
  }
}

export function organizationToken() {
  return process.env.SANITY_ORGANIZATION_TOKEN
}

export async function connectMcp(url: string, token: string) {
  return createMCPClient({
    transport: {
      type: 'http',
      url,
      headers: {Authorization: `Bearer ${token}`},
    },
  })
}

// Thrown when an MCP's /initial-context endpoint refuses or fails. In
// Knowledge Base mode the outline is the only way the agent learns which
// paths exist, so an empty outline is a broken agent, not a degraded one.
export class InitialContextError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`Initial context request to ${url} failed with HTTP ${status}`)
    this.name = 'InitialContextError'
  }
}

// The docs recommend fetching initial context once at startup and inlining
// it. A short TTL keeps that behaviour while still picking up a Knowledge
// Base rebuild without a redeploy.
const INITIAL_CONTEXT_TTL_MS = 5 * 60 * 1000
const initialContextCache = new Map<string, {value: string; expires: number}>()

export async function fetchInitialContext(url: string, token: string): Promise<string> {
  const cached = initialContextCache.get(url)
  if (cached && cached.expires > Date.now()) return cached.value

  // Append to the pathname rather than the string so query params on the MCP
  // URL (for example ?workspace=) survive. The endpoint returns text/plain.
  const target = new URL(url)
  target.pathname = `${target.pathname.replace(/\/$/, '')}/initial-context`
  const response = await fetch(target, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/plain',
    },
  })
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300)
    throw new InitialContextError(url, response.status, detail)
  }
  const value = (await response.text()).trim()
  if (!value) {
    throw new InitialContextError(url, response.status, 'empty initial context response')
  }
  initialContextCache.set(url, {value, expires: Date.now() + INITIAL_CONTEXT_TTL_MS})
  return value
}

function asToolSet(value: unknown): ToolSet {
  return (value ?? {}) as ToolSet
}

// Tools keep their original names and descriptions: initial context refers to
// them by those names. Only initial_context itself is dropped, because its
// payload is already inlined into the system prompt.
export function omitTools(tools: ToolSet, names: string[]): ToolSet {
  const omit = new Set(names)
  return Object.fromEntries(Object.entries(tools).filter(([key]) => !omit.has(key)))
}

export function mergeToolSets(...sets: ToolSet[]): ToolSet {
  return Object.assign({}, ...sets.map(asToolSet))
}
