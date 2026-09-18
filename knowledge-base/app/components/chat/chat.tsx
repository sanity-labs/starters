'use client'

import {useChat} from '@ai-sdk/react'
import {DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls} from 'ai'
import {useMemo, useState} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import {ResultCards, type CardType} from './result-cards'

const GROQ_TOOLS = new Set([
  'query_catalog',
  'query_ops',
  'explore_catalog_schema',
  'explore_ops_schema',
  'read_array_field',
  'groq_query',
  'schema_explorer',
])

const KB_TOOLS = new Set(['read_knowledge_base', 'knowledge_base_read'])

const TOOL_LABELS: Record<string, string> = {
  query_catalog: 'Filtering the catalog',
  query_ops: 'Querying policies',
  explore_catalog_schema: 'Checking catalog fields',
  explore_ops_schema: 'Checking policy fields',
  read_array_field: 'Reading document content',
  read_knowledge_base: 'Reading Knowledge Base entries',
  groq_query: 'Running a GROQ query',
  knowledge_base_read: 'Reading Knowledge Base entries',
  schema_explorer: 'Checking schema',
}

type Surface = 'support' | 'ops'

const COPY: Record<
  Surface,
  {
    title: string
    body: string
    api: string
    suggestions: {label: string; mode: 'GROQ' | 'KB'; text: string}[]
  }
> = {
  support: {
    title: 'Customer support',
    body: 'GROQ answers structured facts. The Knowledge Base answers grounded prose. The agent picks one per question.',
    api: '/api/chat',
    suggestions: [
      {label: 'GROQ', text: 'Which plan includes SMS under $200/mo?', mode: 'GROQ'},
      {label: 'KB', text: "Is a paused campaign's audience still billed?", mode: 'KB'},
    ],
  },
  ops: {
    title: 'Internal ops',
    body: 'Staff surface. Policies and catalog facts go through GROQ. Runbooks go through the internal Knowledge Base.',
    api: '/api/chat/internal',
    suggestions: [
      {label: 'GROQ', text: 'Which critical policies are overdue for review?', mode: 'GROQ'},
      {label: 'KB', text: 'What are the first 15 minutes of a SEV-1?', mode: 'KB'},
    ],
  },
}

function modeForTool(name: string): 'GROQ' | 'KB' | null {
  if (GROQ_TOOLS.has(name)) return 'GROQ'
  if (KB_TOOLS.has(name)) return 'KB'
  return null
}

function ModeBadge({mode}: {mode: 'GROQ' | 'KB'}) {
  return (
    <span className="inline-flex items-center rounded-sm border border-border-faint px-1.5 py-0.5 font-mono text-micro uppercase tracking-wide text-fg-subtle">
      {mode}
    </span>
  )
}

export function Chat({surface}: {surface: Surface}) {
  const copy = COPY[surface]
  const transport = useMemo(() => new DefaultChatTransport({api: copy.api}), [copy.api])
  const {messages, sendMessage, status, stop, setMessages} = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })
  const [input, setInput] = useState('')
  const busy = status === 'submitted' || status === 'streaming'

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setInput('')
    sendMessage({text: trimmed})
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-3xl flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {messages.length === 0 ? (
          <div className="space-y-4 pt-8">
            <p className="font-mono text-micro uppercase tracking-wide text-fg-subtle">
              {surface === 'support' ? 'SC02 · Support agent' : 'SC03 · Ops agent'}
            </p>
            <h2 className="text-display-sm text-fg-base">{copy.title}</h2>
            <p className="text-fg-muted">{copy.body}</p>
            <div className="grid gap-2 pt-2 sm:grid-cols-2">
              {copy.suggestions.map((s) => (
                <button
                  key={s.text}
                  onClick={() => send(s.text)}
                  className="rounded-sm border border-border-faint bg-bg-card px-4 py-3 text-left hover:bg-bg-subtle duration-fast"
                >
                  <ModeBadge mode={s.mode} />
                  <p className="mt-2 text-sm text-fg-base">{s.text}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={message.role === 'user' ? 'flex justify-end' : 'flex flex-col gap-2'}
            >
              {message.parts.map((part, i) => {
                if (part.type === 'text' && part.text.trim()) {
                  if (message.role === 'user') {
                    return (
                      <div
                        key={i}
                        className="max-w-[80%] whitespace-pre-wrap rounded-sm bg-bg-inverse px-4 py-2 text-sm text-fg-inverse"
                      >
                        {part.text}
                      </div>
                    )
                  }
                  return (
                    <div key={i} className="prose prose-sm max-w-[80%] text-fg-base">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
                    </div>
                  )
                }
                if (part.type === 'tool-displayCards' && part.state === 'output-available') {
                  const {type, items} = part.output as {
                    type: CardType
                    items: Record<string, unknown>[]
                  }
                  return <ResultCards key={i} type={type} items={items} />
                }
                if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) {
                  const name =
                    part.type === 'dynamic-tool' ? part.toolName : part.type.slice('tool-'.length)
                  if (name === 'displayCards') return null
                  const running = !('state' in part) || part.state !== 'output-available'
                  const mode = modeForTool(name)
                  return (
                    <p
                      key={i}
                      className={`flex items-center gap-2 text-xs text-fg-subtle ${running ? 'animate-pulse' : ''}`}
                    >
                      {mode && <ModeBadge mode={mode} />}
                      {TOOL_LABELS[name] ?? 'Working'}
                    </p>
                  )
                }
                return null
              })}
            </div>
          ))
        )}
        {status === 'submitted' && <p className="text-sm text-fg-subtle">Retrieving…</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="flex items-center gap-2 border-t border-border-faint py-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question"
          className="flex-1 rounded-sm border border-border-base bg-bg-card px-4 py-2 text-sm outline-none focus:border-border-focus"
        />
        {busy ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-sm bg-bg-subtle px-4 py-2 text-sm font-medium text-fg-base"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-sm bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-brand-hover duration-fast"
          >
            Send
          </button>
        )}
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="text-sm text-fg-subtle hover:text-fg-base"
          >
            Clear
          </button>
        )}
      </form>
    </div>
  )
}
