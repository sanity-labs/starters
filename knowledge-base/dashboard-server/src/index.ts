import {anthropic} from '@ai-sdk/anthropic'
import {createMCPClient} from '@ai-sdk/mcp'
import {sanityInsightsIntegration} from '@sanity/agent-context/ai-sdk'
import {createClient} from '@sanity/client'
import {serve} from '@hono/node-server'
import {convertToModelMessages, stepCountIs, streamText, tool, type ToolSet, zodSchema} from 'ai'
import {Hono} from 'hono'
import {cors} from 'hono/cors'
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

const app = new Hono()

app.use(
  '/api/*',
  cors({
    origin: process.env.DASHBOARD_ORIGIN ?? '*',
    allowHeaders: ['Content-Type'],
    allowMethods: ['POST', 'OPTIONS'],
  }),
)

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
