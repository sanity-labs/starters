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

export async function fetchInitialContext(url: string, token: string): Promise<string> {
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/initial-context`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
    if (!response.ok) return ''
    const text = await response.text()
    return text.trim()
  } catch {
    return ''
  }
}

function asToolSet(value: unknown): ToolSet {
  return (value ?? {}) as ToolSet
}

export function renameTools(
  tools: ToolSet,
  names: Record<string, {name: string; description: string}>,
): ToolSet {
  const next: ToolSet = {}
  for (const [key, tool] of Object.entries(tools)) {
    const mapped = names[key]
    if (!mapped) continue
    next[mapped.name] = {...tool, description: mapped.description}
  }
  return next
}

export function mergeToolSets(...sets: ToolSet[]): ToolSet {
  return Object.assign({}, ...sets.map(asToolSet))
}
