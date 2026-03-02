import {isTextUIPart, type UIMessage} from 'ai'

import {cn} from '@/lib/utils'

import {TextPart} from './TextPart'

interface MessageProps {
  message: UIMessage
}

export function Message({message}: MessageProps) {
  const isUser = message.role === 'user'
  const parts = message.parts ?? []

  const content = parts.filter(isTextUIPart).filter((part) => part.text.trim())

  if (content.length === 0) return null

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] space-y-2 rounded-2xl px-4 py-3 text-sm',
          isUser ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-900',
        )}
      >
        {content.map((part, i) => {
          return <TextPart key={i} text={part.text} isUser={isUser} />
        })}
      </div>
    </div>
  )
}
