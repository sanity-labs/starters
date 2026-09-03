import {anthropic} from '@ai-sdk/anthropic'
import {createMCPClient} from '@ai-sdk/mcp'
import {sanityInsightsIntegration} from '@sanity/agent-context/ai-sdk'
import {createClient} from '@sanity/client'
import {serve} from '@hono/node-server'
import {convertToModelMessages, stepCountIs, streamText, tool, type ToolSet, zodSchema} from 'ai'
import {Hono} from 'hono'
import {cors} from 'hono/cors'
import {timingSafeEqual} from 'node:crypto'
import {z} from 'zod'

import {MODEL_ID, SYSTEM_PROMPT} from './constants'

// .env.local (written by bootstrap) takes precedence — loadEnvFile never
// overwrites vars that are already set.
for (const file of ['../.env.local', '../.env']) {
  try {
    process.loadEnvFile(new URL(file, import.meta.url))
  } catch {}
}

// Chat proxy for the App SDK dashboard. Holds the INTERNAL read token and calls
// the internal Agent Context (Team KB). The App SDK app is browser-only and
// can't hold a token, so this server is the secret boundary.
const displayCards = tool({
  description:
    'Display the source documents as cards in the chat UI. Call once per content type after answering, passing the documents you used.',
  inputSchema: zodSchema(
    z.object({
      type: z.enum(['articles', 'faqs', 'playbooks', 'policies']),
      items: z.array(z.record(z.string(), z.unknown())),
    }),
  ),
  execute: async ({type, items}) => ({type, items}),
})

// Saves conversations to Sanity so they show up in the Studio's Agent Insights
// dashboard. Optional: without the write token, chat works and telemetry is
// skipped. A fresh integration instance is required per request — instances
// must not be shared across concurrent streams.
function insightsTelemetry(threadId: string) {
  const token = process.env.SANITY_INSIGHTS_WRITE_TOKEN
  const projectId = process.env.SANITY_PROJECT_ID
  const dataset = process.env.SANITY_DATASET
  if (!token || !projectId || !dataset) return undefined
  return {
    isEnabled: true,
    integrations: [
      sanityInsightsIntegration({
        client: createClient({
          projectId,
          dataset,
          apiVersion: '2025-03-01',
          token,
          useCdn: false,
          requestTagPrefix: 'insights.kb',
        }),
        agentId: 'team-kb',
        threadId,
      }),
    ],
  }
}

// ── Access control ───────────────────────────────────────────────────────────
// This proxy fronts the internal knowledge base (policies, playbooks, HR,
// security), so it must not be callable by anyone who can reach the port. The
// dashboard presents a shared secret as a bearer token; requests without it
// get 401, and the proxy fails closed (500) if the secret was never configured.
// This is a minimal gate for a starter — a real deployment should sit behind
// its own SSO / auth layer (or verify the caller's Sanity session) instead.

const isProduction = process.env.NODE_ENV === 'production'
const apiToken = process.env.DASHBOARD_API_TOKEN

if (!apiToken) {
  console.error(
    'DASHBOARD_API_TOKEN is not set — /api/chat will refuse every request.\n' +
      '  Run `pnpm bootstrap`, or set DASHBOARD_API_TOKEN in dashboard-server/.env.local and\n' +
      '  the same value as SANITY_APP_DASHBOARD_API_TOKEN in dashboard/.env.local.',
  )
}

// CORS is never a wildcard. Production must name the dashboard's origin; dev
// falls back to the local App SDK dev server.
const allowedOrigins = process.env.DASHBOARD_ORIGIN
  ? [process.env.DASHBOARD_ORIGIN]
  : isProduction
    ? []
    : ['http://localhost:3333']

if (allowedOrigins.length === 0) {
  console.error(
    'DASHBOARD_ORIGIN is not set — browsers will be blocked by CORS. Set it to the deployed dashboard origin.',
  )
}

const isAuthorized = (authorizationHeader: string | undefined): boolean => {
  if (!apiToken || !authorizationHeader?.startsWith('Bearer ')) return false
  const presented = Buffer.from(authorizationHeader.slice('Bearer '.length))
  const expected = Buffer.from(apiToken)
  return presented.length === expected.length && timingSafeEqual(presented, expected)
}

const app = new Hono()

app.use(
  '/api/*',
  cors({
    origin: allowedOrigins,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'OPTIONS'],
  }),
)

// Runs after cors() so preflight requests still get their headers.
app.use('/api/*', async (c, next) => {
  if (!apiToken) return c.json({error: 'DASHBOARD_API_TOKEN is not set'}, 500)
  if (!isAuthorized(c.req.header('Authorization'))) return c.json({error: 'Unauthorized'}, 401)
  await next()
})

app.post('/api/chat', async (c) => {
  // `id` is the chat id — the AI SDK's default transport sends it with every
  // request, so it doubles as a stable per-conversation thread id.
  const {messages, id} = await c.req.json()

  const mcpUrl = process.env.SANITY_AGENT_CONTEXT_URL_INTERNAL
  if (!mcpUrl) return c.json({error: 'SANITY_AGENT_CONTEXT_URL_INTERNAL is not set'}, 500)

  const mcpClient = await createMCPClient({
    transport: {
      type: 'http',
      url: mcpUrl,
      headers: {Authorization: `Bearer ${process.env.SANITY_READ_TOKEN_INTERNAL}`},
    },
  })

  try {
    const mcpTools = await mcpClient.tools()
    const result = streamText({
      model: anthropic(MODEL_ID),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      tools: {...mcpTools, displayCards} as ToolSet,
      stopWhen: stepCountIs(8),
      experimental_telemetry: insightsTelemetry(typeof id === 'string' ? id : crypto.randomUUID()),
      onFinish: () => mcpClient.close(),
    })
    return result.toUIMessageStreamResponse()
  } catch (error) {
    await mcpClient.close()
    throw error
  }
})

const port = Number(process.env.PORT ?? 8788)
serve({fetch: app.fetch, port})
console.log(`dashboard-server listening on http://localhost:${port}`)
