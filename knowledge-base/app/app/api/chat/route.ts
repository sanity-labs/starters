import {anthropic} from '@ai-sdk/anthropic'
import {createMCPClient} from '@ai-sdk/mcp'
import {sanityInsightsIntegration} from '@sanity/agent-context/ai-sdk'
import {createClient} from '@sanity/client'
import {convertToModelMessages, stepCountIs, streamText, tool, type ToolSet, zodSchema} from 'ai'
import {z} from 'zod'

import {MODEL_ID, SYSTEM_PROMPT} from '@/lib/constants'

// Saves conversations to Sanity so they show up in the Studio's Agent Insights
// dashboard. Optional: without the write token, chat works and telemetry is
// skipped. A fresh integration instance is required per request — instances
// must not be shared across concurrent streams.
function insightsTelemetry(threadId: string) {
  const token = process.env.SANITY_INSIGHTS_WRITE_TOKEN
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
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
        agentId: 'customer-support',
        threadId,
      }),
    ],
  }
}

// UI tool: the agent calls this with the documents it used so the client can
// render rich cards. It executes server-side and just echoes its input back.
const displayCards = tool({
  description:
    'Display the source help articles or FAQs as rich cards in the chat UI. Call once per content type after answering, passing the documents you used.',
  inputSchema: zodSchema(
    z.object({
      type: z.enum(['articles', 'faqs']),
      items: z.array(z.record(z.string(), z.unknown())),
    }),
  ),
  execute: async ({type, items}) => ({type, items}),
})

export async function POST(req: Request) {
  // `id` is the chat id — the AI SDK's default transport sends it with every
  // request, so it doubles as a stable per-conversation thread id.
  const {messages, id} = await req.json()

  const mcpUrl = process.env.SANITY_AGENT_CONTEXT_URL
  if (!mcpUrl) throw new Error('SANITY_AGENT_CONTEXT_URL is not set')

  // The read token stays on the server — it is never sent to the browser.
  const mcpClient = await createMCPClient({
    transport: {
      type: 'http',
      url: mcpUrl,
      headers: {Authorization: `Bearer ${process.env.SANITY_READ_TOKEN_EXTERNAL}`},
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
}
