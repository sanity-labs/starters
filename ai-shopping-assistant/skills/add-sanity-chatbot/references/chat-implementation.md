# Chat Implementation Guide

Complete guide for adding the chat API route and UI components to your existing Next.js app.

## Contents

- [1. Chat API Route](#1-chat-api-route)
- [2. Client Tools (Optional)](#2-client-tools-optional)
- [3. Context Capture (Optional)](#3-context-capture-optional)
- [4. Chat UI Component](#4-chat-ui-component)
- [5. Mount the Chat Widget](#5-mount-the-chat-widget)
- [6. Advanced Patterns](#6-advanced-patterns)

---

## 1. Chat API Route

Create `app/api/chat/route.ts` (App Router):

```ts
import {anthropic} from '@ai-sdk/anthropic'
import {createMCPClient} from '@ai-sdk/mcp'
import {convertToModelMessages, streamText, type UIMessage} from 'ai'

const SYSTEM_PROMPT = `
You are a helpful assistant for this website.

## Your Capabilities
- Search and retrieve content using the available tools
- Answer questions about the site's content
- Help users find what they're looking for

## How to Respond
- Be concise and helpful
- When referencing content, include relevant details
- If you can't find what the user wants, suggest alternatives

## Tool Usage
- Use initial_context first to understand available content types
- Use groq_query to find specific content
- Use schema_explorer when you need field details
`

export async function POST(req: Request) {
  const {messages}: {messages: UIMessage[]} = await req.json()

  if (!process.env.SANITY_CONTEXT_MCP_URL) {
    throw new Error('SANITY_CONTEXT_MCP_URL is not set')
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }

  const mcpClient = await createMCPClient({
    transport: {
      type: 'http',
      url: process.env.SANITY_CONTEXT_MCP_URL,
      headers: {
        Authorization: `Bearer ${process.env.SANITY_API_READ_TOKEN}`,
      },
    },
  })

  try {
    const mcpTools = await mcpClient.tools()

    const result = streamText({
      model: anthropic('claude-sonnet-4-5-20250929'),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      tools: {
        ...mcpTools,
      },
      maxSteps: 10,
      onFinish: async () => {
        await mcpClient.close()
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    await mcpClient.close()
    throw error
  }
}
```

**Key points:**

- `createMCPClient` connects to Sanity Context MCP via HTTP transport
- `mcpClient.tools()` returns the available tools (`initial_context`, `groq_query`, `schema_explorer`)
- `convertToModelMessages(messages)` is **required** in AI SDK v6. Do not pass raw `UIMessage[]`
- `maxSteps: 10` allows the LLM to make multiple tool calls in sequence
- Always close the MCP client when done

### Using a different LLM provider

Replace the Anthropic provider with any AI SDK-compatible provider:

```ts
// OpenAI
import {openai} from '@ai-sdk/openai'
model: openai('gpt-4o'),

// Google
import {google} from '@ai-sdk/google'
model: google('gemini-2.0-flash'),
```

Install the corresponding provider package (e.g., `npm install @ai-sdk/openai`).

---

## 2. Client Tools (Optional)

If you want the chatbot to capture page context or screenshots, create a shared tools file.

Create `lib/client-tools.ts`:

```ts
import {z} from 'zod'

/** User context sent with every message so the agent knows where the user is. */
export interface UserContext {
  documentTitle: string
  documentDescription?: string
  documentLocation: string
}

/** Tool names - single source of truth for definitions and handlers. */
export const CLIENT_TOOLS = {
  PAGE_CONTEXT: 'get_page_context',
  SCREENSHOT: 'get_page_screenshot',
} as const

export type ClientToolName = (typeof CLIENT_TOOLS)[keyof typeof CLIENT_TOOLS]
```

Then update the API route to include client tools (tools without `execute`; execution happens on the client):

```ts
import {type ToolSet} from 'ai'
import {z} from 'zod'
import {CLIENT_TOOLS, type UserContext} from '@/lib/client-tools'

const clientTools: ToolSet = {
  [CLIENT_TOOLS.PAGE_CONTEXT]: {
    description: 'Page context as markdown: URL, title, and text content. Fast. No visuals.',
    inputSchema: z.object({
      reason: z.string().describe('Why you need page context'),
    }),
  },
  [CLIENT_TOOLS.SCREENSHOT]: {
    description: 'Visual screenshot of the page. Use when you need to see images, colors, or layout.',
    inputSchema: z.object({
      reason: z.string().describe('Why you need a screenshot'),
    }),
  },
}

// In the streamText call, combine tools:
tools: {
  ...mcpTools,
  ...clientTools,
},
```

---

## 3. Context Capture (Optional)

If using client tools, create browser-side capture functions.

Create `lib/capture-context.ts`:

```ts
import type {UserContext} from './client-tools'

/** Attribute to mark the chat element (excluded from capture). */
export const AGENT_CHAT_HIDDEN_ATTRIBUTE = 'agent-chat-hidden'

/** Lightweight context sent with every message. */
export function captureUserContext(): UserContext {
  const metaDescription =
    document.querySelector('meta[name="description"]')?.getAttribute('content') ||
    document.querySelector('meta[property="og:description"]')?.getAttribute('content')

  return {
    documentTitle: document.title,
    documentDescription: metaDescription || undefined,
    documentLocation: window.location.pathname,
  }
}

/**
 * Captures page content as markdown.
 * Requires: npm install turndown && npm install -D @types/turndown
 */
export function capturePageContext() {
  // Dynamic import to avoid SSR issues
  const TurndownService = require('turndown')
  const turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
  })

  // Replace images with alt text only
  turndown.addRule('images', {
    filter: 'img',
    replacement: (_content: string, node: HTMLElement) => {
      const alt = (node as HTMLImageElement).alt
      return alt ? alt : ''
    },
  })

  // Remove scripts, styles, and other noise
  turndown.addRule('removeNoise', {
    filter: (node: HTMLElement) =>
      ['SCRIPT', 'STYLE', 'SVG', 'VIDEO', 'AUDIO', 'IFRAME', 'NOSCRIPT'].includes(node.nodeName),
    replacement: () => '',
  })

  const main = document.querySelector('main') || document.body
  const clone = main.cloneNode(true) as Element

  // Remove the chat widget from the capture
  clone.querySelectorAll(`[${AGENT_CHAT_HIDDEN_ATTRIBUTE}]`).forEach((el) => el.remove())

  return {
    url: window.location.href,
    title: document.title,
    content: turndown.turndown(clone.innerHTML).slice(0, 4000),
  }
}

/**
 * Captures a screenshot of the page.
 * Requires: npm install html2canvas-pro
 */
export async function captureScreenshot() {
  const html2canvas = (await import('html2canvas-pro')).default
  const canvas = await html2canvas(document.body, {
    ignoreElements: (el: Element) => el.hasAttribute(AGENT_CHAT_HIDDEN_ATTRIBUTE),
  })

  const MAX_DIMENSION = 4000
  let finalCanvas = canvas

  if (canvas.width > MAX_DIMENSION || canvas.height > MAX_DIMENSION) {
    const scale = Math.min(MAX_DIMENSION / canvas.width, MAX_DIMENSION / canvas.height)
    const resizedCanvas = document.createElement('canvas')
    resizedCanvas.width = Math.floor(canvas.width * scale)
    resizedCanvas.height = Math.floor(canvas.height * scale)
    const ctx = resizedCanvas.getContext('2d')
    ctx?.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height)
    finalCanvas = resizedCanvas
  }

  return finalCanvas.toDataURL('image/jpeg', 0.7)
}
```

---

## 4. Chat UI Component

Create a chat component. Below is a minimal version, followed by a full-featured version.

### Minimal Chat Component

Create `components/chat/Chat.tsx`:

```tsx
'use client'

import {useChat} from '@ai-sdk/react'
import {type UIMessage} from 'ai'
import {useState} from 'react'

export function Chat() {
  const [isOpen, setIsOpen] = useState(false)
  const {messages, sendMessage, status, error} = useChat()
  const [input, setInput] = useState('')

  const isLoading = status === 'submitted' || status === 'streaming'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage({text: input})
    setInput('')
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          padding: '0.75rem 1.5rem',
          borderRadius: '9999px',
          backgroundColor: '#171717',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.875rem',
          zIndex: 50,
        }}
      >
        Chat
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        width: '24rem',
        height: '36rem',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '1rem',
        border: '1px solid #e5e5e5',
        backgroundColor: 'white',
        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          backgroundColor: '#171717',
          color: 'white',
        }}
      >
        <span style={{fontWeight: 500, fontSize: '0.875rem'}}>Chat Assistant</span>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#a3a3a3',
            cursor: 'pointer',
            fontSize: '1.25rem',
          }}
        >
          &times;
        </button>
      </div>

      {/* Messages */}
      <div style={{flex: 1, overflowY: 'auto', padding: '1rem'}}>
        {messages.length === 0 ? (
          <p style={{textAlign: 'center', color: '#a3a3a3', fontSize: '0.875rem'}}>
            Ask me anything about this site.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              style={{
                marginBottom: '0.75rem',
                textAlign: message.role === 'user' ? 'right' : 'left',
              }}
            >
              {(message.parts ?? [])
                .filter((part) => part.type === 'text' && part.text.trim())
                .map((part, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'inline-block',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.75rem',
                      fontSize: '0.875rem',
                      maxWidth: '80%',
                      backgroundColor: message.role === 'user' ? '#171717' : '#f5f5f5',
                      color: message.role === 'user' ? 'white' : '#171717',
                    }}
                  >
                    {part.type === 'text' ? part.text : null}
                  </div>
                ))}
            </div>
          ))
        )}

        {isLoading && (
          <div style={{color: '#a3a3a3', fontSize: '0.875rem'}}>Thinking...</div>
        )}

        {error && (
          <div style={{color: '#ef4444', fontSize: '0.875rem'}}>
            Something went wrong. Please try again.
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          borderTop: '1px solid #e5e5e5',
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid #d4d4d4',
            fontSize: '0.875rem',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            backgroundColor: '#171717',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            opacity: isLoading || !input.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}
```

### Full-Featured Chat Component

For a production-ready component with client-side tools, auto-continuation, and user context, see the ecommerce reference implementation. Key additions:

**Auto-continuation**: automatically continue the conversation when tool calls complete:

```tsx
import {DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls} from 'ai'

const {messages, sendMessage, status, addToolOutput, error} = useChat({
  // Include user context with every request
  transport: new DefaultChatTransport({
    body: () => ({userContext: captureUserContext()}),
  }),
  // Auto-continue when tool calls complete
  sendAutomaticallyWhen: ({messages}) => {
    return lastAssistantMessageIsCompleteWithToolCalls({messages})
  },
  // Handle client-side tool execution
  onToolCall: async ({toolCall}) => {
    if (toolCall.dynamic) return

    switch (toolCall.toolName) {
      case CLIENT_TOOLS.PAGE_CONTEXT: {
        addToolOutput({
          tool: CLIENT_TOOLS.PAGE_CONTEXT,
          toolCallId: toolCall.toolCallId,
          output: capturePageContext(),
        })
        return
      }
      case CLIENT_TOOLS.SCREENSHOT: {
        try {
          const file = await captureScreenshot()
          addToolOutput({
            tool: CLIENT_TOOLS.SCREENSHOT,
            toolCallId: toolCall.toolCallId,
            output: 'Screenshot captured.',
          })
          // Note: send file as follow-up message since addToolOutput doesn't support files
        } catch (err) {
          addToolOutput({
            tool: CLIENT_TOOLS.SCREENSHOT,
            toolCallId: toolCall.toolCallId,
            output: `Failed to capture screenshot: ${err instanceof Error ? err.message : String(err)}`,
          })
        }
        return
      }
    }
  },
})
```

---

## 5. Mount the Chat Widget

Add the chat component to your layout or a page.

**In your root layout** (`app/layout.tsx`):

```tsx
import {Chat} from '@/components/chat/Chat'

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Chat />
      </body>
    </html>
  )
}
```

**Or on specific pages only:**

```tsx
import {Chat} from '@/components/chat/Chat'

export default function ProductsPage() {
  return (
    <main>
      {/* your page content */}
      <Chat />
    </main>
  )
}
```

---

## 6. Advanced Patterns

### User Context with Every Request

Send the current page URL and title with every message so the agent has context:

```tsx
// In Chat component
transport: new DefaultChatTransport({
  body: () => ({userContext: captureUserContext()}),
}),
```

Then in the API route, extract and use it in the system prompt:

```ts
const {messages, userContext}: {messages: UIMessage[]; userContext: UserContext} = await req.json()

const systemPrompt = `${SYSTEM_PROMPT}

# Page context
The user is currently on: ${userContext.documentTitle} (${userContext.documentLocation})
`
```

### Storing the System Prompt in Sanity

Instead of hardcoding the prompt, store it in a Sanity document for easy editing:

1. Create a schema type (e.g., `agent.config`) with a `systemPrompt` text field
2. Fetch it in the API route:

```ts
import {client} from '@/sanity/lib/client'

const agentConfig = await client.fetch<{systemPrompt: string} | null>(
  `*[_type == "agent.config" && slug.current == "default"][0] { systemPrompt }`,
)
```

### Custom Content Rendering

For rich content display (product cards, article previews), define custom markdown directives in the system prompt and parse them in the UI. See the ecommerce reference for the `::document{id="..." type="..."}` pattern with `remark-directive`.
