import {createAnthropic} from '@ai-sdk/anthropic'
import {convertToModelMessages, stepCountIs, streamText, tool, type ToolSet, zodSchema} from 'ai'
import {z} from 'zod'

import {MODEL_ID, OPS_SYSTEM_PROMPT, SUPPORT_SYSTEM_PROMPT} from '@/lib/constants'
import {
  connectMcp,
  fetchInitialContext,
  mergeToolSets,
  mcpUrls,
  organizationToken,
  renameTools,
  type Surface,
} from '@/lib/mcp'

const displayCards = tool({
  description:
    'Display the structured records you used as cards. Call once per type after answering.',
  inputSchema: zodSchema(
    z.object({
      type: z.enum(['products', 'faqs', 'policies', 'articles']),
      items: z.array(z.record(z.string(), z.unknown())),
    }),
  ),
  execute: async ({type, items}) => ({type, items}),
})

export async function handleChat(req: Request, surface: Surface) {
  const {messages} = await req.json()
  const token = organizationToken()
  const urls = mcpUrls(surface)

  if (!token || !urls.groq || !urls.kb) {
    return Response.json(
      {
        error:
          'Chat is not configured. Add SANITY_ORGANIZATION_TOKEN and the four SANITY_MCP_* URLs from the Context app. See the README.',
      },
      {status: 503},
    )
  }

  const [groqClient, kbClient] = await Promise.all([
    connectMcp(urls.groq, token),
    connectMcp(urls.kb, token),
  ])

  try {
    const [groqTools, kbTools, groqContext, kbContext] = await Promise.all([
      groqClient.tools(),
      kbClient.tools(),
      fetchInitialContext(urls.groq, token),
      fetchInitialContext(urls.kb, token),
    ])

    const groqRenamed =
      surface === 'support'
        ? renameTools(groqTools, {
            groq_query: {
              name: 'query_catalog',
              description:
                'Query the Beacon product catalog and FAQs in Sanity. Use for prices, plan tiers, channels, seat limits, and exact FAQ facts. Not for runbooks or long-form how-to.',
            },
            schema_explorer: {
              name: 'explore_catalog_schema',
              description: 'Inspect product or faq fields before writing a GROQ query.',
            },
            array_field_reader: {
              name: 'read_array_field',
              description: 'Read a large array or Portable Text field from one catalog document.',
            },
          })
        : renameTools(groqTools, {
            groq_query: {
              name: 'query_ops',
              description:
                'Query internal policies and the product catalog in Sanity. Use for review dates, importance, owners, and catalog facts staff need to quote. Not for runbooks.',
            },
            schema_explorer: {
              name: 'explore_ops_schema',
              description: 'Inspect policy or product fields before writing a GROQ query.',
            },
            array_field_reader: {
              name: 'read_array_field',
              description: 'Read a large array or Portable Text field from one ops document.',
            },
          })

    const kbRenamed = renameTools(kbTools, {
      knowledge_base_read: {
        name: 'read_knowledge_base',
        description:
          'Read grounded Knowledge Base entries by path from the outline. Use for how-to, deliverability, runbooks, and policy explained in prose. Not for filtering products by price or channel.',
      },
    })

    const basePrompt = surface === 'support' ? SUPPORT_SYSTEM_PROMPT : OPS_SYSTEM_PROMPT
    const system = [
      basePrompt,
      groqContext && `## GROQ initial context\n${groqContext}`,
      kbContext && `## Knowledge Base outline\n${kbContext}`,
    ]
      .filter(Boolean)
      .join('\n\n')

    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID
    const anthropic = createAnthropic({
      headers: workspaceId ? {'anthropic-workspace-id': workspaceId} : undefined,
    })

    const result = streamText({
      model: anthropic(MODEL_ID),
      system,
      messages: await convertToModelMessages(messages),
      tools: mergeToolSets(groqRenamed, kbRenamed, {displayCards}) as ToolSet,
      stopWhen: stepCountIs(8),
      onFinish: async () => {
        await Promise.all([groqClient.close(), kbClient.close()])
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    await Promise.all([groqClient.close(), kbClient.close()])
    throw error
  }
}
