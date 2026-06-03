import {anthropic} from '@ai-sdk/anthropic'
import {createMCPClient} from '@ai-sdk/mcp'
import {convertToModelMessages, stepCountIs, streamText, tool, type ToolSet, zodSchema} from 'ai'
import {z} from 'zod'

import {MODEL_ID, SYSTEM_PROMPT} from '@/lib/constants'

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
  const {messages} = await req.json()

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
      onFinish: () => mcpClient.close(),
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    await mcpClient.close()
    throw error
  }
}
