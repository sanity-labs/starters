'use client'

import {useChat} from '@ai-sdk/react'
import {lastAssistantMessageIsCompleteWithToolCalls} from 'ai'
import {useState} from 'react'

import {ResultCards} from './result-cards'

const SUGGESTIONS = [
  'How do I authenticate my sending domain?',
  'What is the difference between a segment and a list?',
  'How is billing calculated?',
]

export function Chat() {
  const {messages, sendMessage, status, stop, setMessages} = useChat({
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
          <div className="space-y-4 pt-12 text-center">
            <h2 className="text-2xl font-semibold text-gray-900">Ask the help center</h2>
            <p className="text-gray-600">Answers come straight from the knowledge base.</p>
            <div className="mx-auto flex max-w-md flex-col gap-2 pt-4">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  {s}
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
                  return (
                    <div
                      key={i}
                      className={
                        message.role === 'user'
                          ? 'max-w-[80%] whitespace-pre-wrap rounded-2xl bg-blue-600 px-4 py-2 text-sm text-white'
                          : 'max-w-[80%] whitespace-pre-wrap text-sm leading-relaxed text-gray-900'
                      }
                    >
                      {part.text}
                    </div>
                  )
                }
                if (part.type === 'tool-displayCards' && part.state === 'output-available') {
                  const {type, items} = part.output as {
                    type: 'articles' | 'faqs'
                    items: Record<string, unknown>[]
                  }
                  return <ResultCards key={i} type={type} items={items} />
                }
                return null
              })}
            </div>
          ))
        )}
        {status === 'submitted' && (
          <p className="text-sm text-gray-400">Searching the knowledge base…</p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="flex items-center gap-2 border-t border-gray-200 py-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm outline-none focus:border-gray-500"
        />
        {busy ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-full bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Send
          </button>
        )}
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </form>
    </div>
  )
}
