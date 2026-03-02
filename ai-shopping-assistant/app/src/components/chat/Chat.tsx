'use client'

import {useChat} from '@ai-sdk/react'
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from 'ai'
import {ArrowDown, MessageCircle, X} from 'lucide-react'
import {useRouter, useSearchParams} from 'next/navigation'
import {Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react'

import {
  AGENT_CHAT_HIDDEN_ATTRIBUTE,
  capturePageContext,
  captureScreenshot,
  captureUserContext,
} from '../../lib/capture-context'
import {CLIENT_TOOLS, type ProductFiltersInput, productFiltersSchema} from '../../lib/client-tools'
import {ChatInput} from './ChatInput'
import {Loader} from './Loader'
import {Message} from './message'
import {ToolCall} from './ToolCall'

const CHAT_ID_KEY = 'chat-id'
const CHAT_MESSAGES_KEY = 'chat-messages'

function getOrCreateChatId(): string {
  try {
    const existing = sessionStorage.getItem(CHAT_ID_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    sessionStorage.setItem(CHAT_ID_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

function loadMessages(): UIMessage[] {
  try {
    const raw = sessionStorage.getItem(CHAT_MESSAGES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveMessages(messages: UIMessage[]) {
  try {
    sessionStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(messages))
  } catch {
    // sessionStorage full or unavailable — silently ignore
  }
}

// Show loader when waiting for text (not actively streaming text)
function isWaitingForText(messages: UIMessage[]): boolean {
  const last = messages[messages.length - 1]
  if (!last || last.role !== 'assistant') return true

  const parts = last.parts ?? []
  if (parts.length === 0) return true

  const lastPart = parts[parts.length - 1]
  return !(lastPart.type === 'text' && lastPart.text.trim().length > 0)
}

interface ChatProps {
  isOpen: boolean
  onClose: () => void
}

const emptySubscribe = () => () => {}

export function Chat(props: ChatProps) {
  // Defer rendering until after hydration — loadMessages() reads sessionStorage
  // which isn't available on the server, causing a hydration mismatch.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  if (!mounted) return null

  return (
    <Suspense fallback={null}>
      <ChatInner {...props} />
    </Suspense>
  )
}

function ChatInner(props: ChatProps) {
  const {onClose} = props

  const router = useRouter()
  const searchParams = useSearchParams()
  const [input, setInput] = useState('')
  const [showScrollButton, setShowScrollButton] = useState(false)
  const debug = searchParams.get('debug') === 'true'
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)

  // Two-phase screenshot flow: capture screenshot as a data URL after the tool output
  // is processed, then send it in a follow-up message. This ensures the AI sees the
  // page state (e.g., filtered results) before deciding its next action, preventing
  // race conditions where screenshots are taken before filter navigation completes.
  const pendingScreenshotRef = useRef<string | null>(null)

  // Track whether user is near the bottom of the scroll container
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isNearBottomRef.current = distanceFromBottom < 30
    setShowScrollButton(distanceFromBottom > 100)
  }, [])

  const scrollToBottom = useCallback(() => {
    isNearBottomRef.current = true
    messagesEndRef.current?.scrollIntoView({behavior: 'smooth'})
  }, [])

  // Apply product filters by navigating to /products with URL params
  const applyProductFilters = useCallback(
    (filters: ProductFiltersInput): string => {
      const params = new URLSearchParams()

      filters.category?.forEach((v) => params.append('category', v))
      filters.color?.forEach((v) => params.append('color', v))
      filters.size?.forEach((v) => params.append('size', v))
      filters.brand?.forEach((v) => params.append('brand', v))
      if (filters.minPrice) params.set('minPrice', String(filters.minPrice))
      if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice))
      if (filters.sort) params.set('sort', filters.sort)

      const newUrl = `/products${params.toString() ? `?${params}` : ''}`
      router.push(newUrl, {scroll: false})
      return newUrl
    },
    [router],
  )

  const [chatId] = useState(getOrCreateChatId)
  const [restoredMessages] = useState(loadMessages)

  const {messages, sendMessage, status, addToolOutput, error, regenerate} = useChat({
    id: chatId,
    messages: restoredMessages,
    // Include user context (page title/location) with every request
    transport: new DefaultChatTransport({
      body: () => ({userContext: captureUserContext()}),
    }),
    // Skip auto-continue when a screenshot is pending — wait for it to be sent
    // as a follow-up message so the AI sees the updated page state.
    sendAutomaticallyWhen: ({messages}) => {
      if (pendingScreenshotRef.current) return false
      return lastAssistantMessageIsCompleteWithToolCalls({messages})
    },
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

            pendingScreenshotRef.current = file

            addToolOutput({
              tool: CLIENT_TOOLS.SCREENSHOT,
              toolCallId: toolCall.toolCallId,
              output: `Screenshot captured.`,
            })
          } catch (err) {
            addToolOutput({
              tool: CLIENT_TOOLS.SCREENSHOT,
              toolCallId: toolCall.toolCallId,
              output: `Failed to capture screenshot: ${err instanceof Error ? err.message : String(err)}`,
            })
          }

          return
        }

        case CLIENT_TOOLS.SET_FILTERS: {
          const result = productFiltersSchema.safeParse(toolCall.input)
          if (!result.success) {
            addToolOutput({
              tool: CLIENT_TOOLS.SET_FILTERS,
              toolCallId: toolCall.toolCallId,
              output: `Invalid filter input: ${result.error.message}`,
            })
            return
          }

          const filters = result.data
          const newUrl = applyProductFilters(filters)

          const changes: string[] = []
          if (filters.category?.length) changes.push(`category: ${filters.category.join(', ')}`)
          if (filters.color?.length) changes.push(`color: ${filters.color.join(', ')}`)
          if (filters.size?.length) changes.push(`size: ${filters.size.join(', ')}`)
          if (filters.brand?.length) changes.push(`brand: ${filters.brand.join(', ')}`)
          if (filters.minPrice) changes.push(`min price: $${filters.minPrice}`)
          if (filters.maxPrice) changes.push(`max price: $${filters.maxPrice}`)
          if (filters.sort) changes.push(`sort: ${filters.sort}`)

          addToolOutput({
            tool: CLIENT_TOOLS.SET_FILTERS,
            toolCallId: toolCall.toolCallId,
            output: `Filters applied${changes.length > 0 ? `: ${changes.join(', ')}` : ''}. Navigated to ${newUrl}.`,
          })

          return
        }
      }
    },
  })

  // Phase 2 of the screenshot flow: once the stream finishes (status === 'ready'),
  // send the captured screenshot as a new user message with the image attached.
  useEffect(() => {
    if (status !== 'ready' || !pendingScreenshotRef.current) return

    const screenshot = pendingScreenshotRef.current
    pendingScreenshotRef.current = null

    sendMessage({
      files: [
        {
          type: 'file' as const,
          filename: 'screenshot.jpg',
          mediaType: 'image/jpeg',
          url: screenshot,
        },
      ],
    })
  }, [status, sendMessage])

  // Persist messages to sessionStorage
  useEffect(() => {
    saveMessages(messages)
  }, [messages])

  // Auto-scroll to bottom only when user is near the bottom (not scrolled up)
  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({behavior: 'smooth'})
    }
  }, [messages])

  // Focus the input when the chat opens
  useEffect(() => {
    if (props.isOpen) {
      inputRef.current?.focus()
    }
  }, [props.isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    isNearBottomRef.current = true
    sendMessage({text: input})
    setInput('')
  }

  const isLoading = status === 'submitted' || status === 'streaming'
  const showLoader = isLoading && isWaitingForText(messages)

  return (
    <div
      {...{[AGENT_CHAT_HIDDEN_ATTRIBUTE]: 'true'}}
      className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
            <MessageCircle className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Shopping Assistant</p>
            <p className="text-xs text-neutral-400">Ask me anything</p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Close chat"
          onClick={onClose}
          className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="relative flex-1 overflow-hidden">
      {showScrollButton && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute cursor-pointer top-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg transition-all hover:bg-neutral-800"
        >
          <ArrowDown className="mr-1 inline h-3 w-3" />
          New messages
        </button>
      )}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="h-full overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-neutral-400">
            <p>Ask me anything about our products.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                {/* Tool calls (debug only) */}
                {debug &&
                  (message.parts ?? []).filter(isToolUIPart).map((part, i) => (
                    <div key={`${message.id}-tool-${i}`} className="flex justify-start">
                      <div className="max-w-[80%]">
                        <ToolCall
                          toolName={getToolName(part)}
                          state={part.state}
                          input={part.input}
                          output={'output' in part ? part.output : undefined}
                        />
                      </div>
                    </div>
                  ))}

                {/* Message text */}
                <Message message={message} />
              </div>
            ))}

            {showLoader && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl bg-neutral-100 px-4 py-2 text-sm text-neutral-900">
                  <Loader />
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-start">
                <div className="flex flex-col gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  <span>Something went wrong.</span>
                  <button
                    type="button"
                    onClick={() => regenerate()}
                    className="w-fit rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      </div>

      {/* Input */}
      <div className="border-t border-neutral-200 p-4">
        <ChatInput ref={inputRef} input={input} setInput={setInput} onSubmit={handleSubmit} disabled={isLoading} />
      </div>
    </div>
  )
}
