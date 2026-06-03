import {useChat} from '@ai-sdk/react'
import {DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls} from 'ai'
import {useMemo, useState} from 'react'

import {ResultCards} from './result-cards'

// Chat talks to the dashboard-server proxy, which holds the internal read token
// and calls the internal Agent Context (Team KB) — the token never reaches here.
export function ChatPanel() {
  const transport = useMemo(
    () => new DefaultChatTransport({api: process.env.SANITY_APP_CHAT_PROXY_URL}),
    [],
  )
  const {messages, sendMessage, status} = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })
  const [input, setInput] = useState('')

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setInput('')
    sendMessage({text: trimmed})
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', height: '100vh'}}>
      <div style={{padding: '16px 24px', borderBottom: '1px solid #e5e7eb'}}>
        <h2 style={{margin: 0, fontSize: 18}}>Team assistant</h2>
        <p style={{margin: '2px 0 0', fontSize: 13, color: '#6b7280'}}>
          Sees both customer-facing and internal content.
        </p>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.length === 0 && (
          <p style={{color: '#9ca3af', fontSize: 14}}>
            Try: “What’s the escalation path for a Tier 1 billing dispute?”
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {message.parts.map((part, i) => {
              if (part.type === 'text' && part.text.trim()) {
                return (
                  <div
                    key={i}
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: 14,
                      lineHeight: 1.5,
                      padding: message.role === 'user' ? '8px 12px' : 0,
                      borderRadius: 12,
                      background: message.role === 'user' ? '#2563eb' : 'transparent',
                      color: message.role === 'user' ? '#fff' : '#111827',
                    }}
                  >
                    {part.text}
                  </div>
                )
              }
              if (part.type === 'tool-displayCards' && part.state === 'output-available') {
                const {type, items} = part.output as {
                  type: string
                  items: Record<string, unknown>[]
                }
                return <ResultCards key={i} type={type} items={items} />
              }
              return null
            })}
          </div>
        ))}
        {status === 'submitted' && <p style={{color: '#9ca3af', fontSize: 13}}>Searching…</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        style={{display: 'flex', gap: 8, padding: 16, borderTop: '1px solid #e5e7eb'}}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #d1d5db',
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontSize: 14,
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}
