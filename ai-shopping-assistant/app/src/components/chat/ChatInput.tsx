import {type Ref} from 'react'
import {Loader2, Send} from 'lucide-react'

import {Button} from '@/components/ui/button'

interface ChatInputProps {
  ref?: Ref<HTMLInputElement>
  input: string
  setInput: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  disabled: boolean
}

export function ChatInput(props: ChatInputProps) {
  const {ref, input, setInput, onSubmit, disabled} = props

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        ref={ref}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="How may I assist you?"
        className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
        disabled={disabled}
      />
      <Button type="submit" size="icon" aria-label="Send message" disabled={disabled || !input.trim()}>
        {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </form>
  )
}
