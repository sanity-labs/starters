import {createAnthropic} from '@ai-sdk/anthropic'
import {convertToModelMessages, stepCountIs, streamText, tool, type ToolSet, zodSchema} from 'ai'
import {z} from 'zod'

import {MODEL_ID, OPS_SYSTEM_PROMPT, SUPPORT_SYSTEM_PROMPT} from '@/lib/constants'
import {
  connectMcp,
  fetchInitialContext,
  InitialContextError,
  mergeToolSets,
  mcpUrls,
  omitTools,
  organizationToken,
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

const EMPTY_TOOLS: ToolSet = {}

type McpClient = Awaited<ReturnType<typeof connectMcp>>

export async function handleChat(req: Request, surface: Surface) {
  const {messages} = await req.json()
  const token = organizationToken()
  const urls = mcpUrls(surface)

  // A surface runs with whichever of its two MCPs is configured, so GROQ mode
  // can be tried before the Knowledge Base is built (and vice versa).
  if (!token || (!urls.groq && !urls.kb)) {
    return Response.json(
      {
        error:
          'Chat is not configured. Add SANITY_ORGANIZATION_TOKEN and at least one SANITY_MCP_* URL for this surface from the Context app. See the README.',
      },
      {status: 503},
    )
  }

  let groqClient: McpClient | null = null
  let kbClient: McpClient | null = null
  // MCP close() is idempotent, so this is safe to call from every exit path.
  const closeClients = async () => {
    await Promise.all([groqClient?.close(), kbClient?.close()])
  }

  try {
    // allSettled, not all: if one connect fails, the other client must still
    // be assigned so closeClients can release it.
    const [groqSettled, kbSettled] = await Promise.allSettled([
      urls.groq ? connectMcp(urls.groq, token) : Promise.resolve(null),
      urls.kb ? connectMcp(urls.kb, token) : Promise.resolve(null),
    ])
    groqClient = groqSettled.status === 'fulfilled' ? groqSettled.value : null
    kbClient = kbSettled.status === 'fulfilled' ? kbSettled.value : null
    if (groqSettled.status === 'rejected') throw groqSettled.reason
    if (kbSettled.status === 'rejected') throw kbSettled.reason

    const [groqTools, kbTools, groqContext, kbContext] = await Promise.all([
      groqClient ? groqClient.tools() : EMPTY_TOOLS,
      kbClient ? kbClient.tools() : EMPTY_TOOLS,
      urls.groq ? fetchInitialContext(urls.groq, token) : '',
      urls.kb ? fetchInitialContext(urls.kb, token) : '',
    ])

    // initial_context is inlined below, so drop the tool. Everything else keeps
    // its name: GROQ mode and Knowledge Base mode expose disjoint tool sets, and
    // initial context refers to tools by their original names.
    const groqToolSet = omitTools(groqTools, ['initial_context'])
    const kbToolSet = omitTools(kbTools, ['initial_context'])

    const basePrompt = surface === 'support' ? SUPPORT_SYSTEM_PROMPT : OPS_SYSTEM_PROMPT
    const system = [
      basePrompt,
      groqContext && `## GROQ initial context\n${groqContext}`,
      kbContext && `## Knowledge Base outline\n${kbContext}`,
      !urls.groq &&
        'GROQ tools are not configured on this deployment. Answer from the Knowledge Base only, and say so when a question needs structured catalog or policy data.',
      !urls.kb &&
        'Knowledge Base tools are not configured on this deployment. Answer from GROQ only, and say so when a question needs long-form how-to or runbook content.',
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
      tools: mergeToolSets(groqToolSet, kbToolSet, {displayCards}) as ToolSet,
      stopWhen: stepCountIs(8),
      // onFinish does not fire when the model errors before its first step
      // completes (for example a bad ANTHROPIC_API_KEY), so close on every path.
      onFinish: closeClients,
      onError: closeClients,
      onAbort: closeClients,
    })

    // If the browser disconnects (Stop), the response stream is cancelled and
    // none of the callbacks above would run. Consuming the stream server-side
    // lets it finish so onFinish still closes the MCP clients.
    result.consumeStream()
    return result.toUIMessageStreamResponse()
  } catch (error) {
    // Everything above streamText is setup (connect, tools, initial context).
    // Report it as JSON so the chat UI can show the reason, not a bare 500.
    await closeClients()
    if (error instanceof InitialContextError) {
      return Response.json(
        {
          error: `Could not load initial context from ${error.url} (HTTP ${error.status}). Check that SANITY_ORGANIZATION_TOKEN is an organization token with Context Viewer and that the MCP URL is correct.${error.detail ? ` Server said: ${error.detail}` : ''}`,
        },
        {status: 502},
      )
    }
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      {
        error: `Could not connect to a Context MCP endpoint. Check the SANITY_MCP_* URLs and SANITY_ORGANIZATION_TOKEN (organization token with Context Viewer). ${message}`,
      },
      {status: 502},
    )
  }
}
