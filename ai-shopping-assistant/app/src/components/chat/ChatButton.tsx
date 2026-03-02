'use client'

import {MessageCircle, X} from 'lucide-react'
import {useCallback, useSyncExternalStore} from 'react'

import {Chat} from './Chat'

const STORAGE_KEY = 'chat-open'
const CHANGE_EVENT = 'chat-open-change'

function setChatOpen(value: boolean) {
  sessionStorage.setItem(STORAGE_KEY, String(value))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function useChatOpen() {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener(CHANGE_EVENT, cb)
    return () => window.removeEventListener(CHANGE_EVENT, cb)
  }, [])
  const getSnapshot = useCallback(
    () => sessionStorage.getItem(STORAGE_KEY) === 'true',
    [],
  )
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export function ChatButton() {
  const isOpen = useChatOpen()

  const toggle = () => setChatOpen(!isOpen)
  const close = () => setChatOpen(false)

  return (
    <>
      {/* Chat Window — full screen on mobile, popup on sm+ */}
      <div
        className={`
          fixed z-50 transition-all duration-300 ease-out
          inset-0 sm:inset-auto sm:bottom-22 sm:right-4 sm:h-125 sm:w-95 sm:origin-bottom-right
          ${isOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'}
        `}
      >
        <Chat isOpen={isOpen} onClose={close} />
      </div>

      {/* Toggle Button — hidden on mobile when chat is open (header X closes instead) */}
      <button
        type="button"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        onClick={toggle}
        className={`
          fixed bottom-4 right-4 z-50 cursor-pointer flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition-all duration-300 ease-out hover:scale-105 hover:shadow-xl active:scale-95
          ${isOpen ? 'max-sm:hidden' : ''}
        `}
      >
        <div className="relative h-6 w-6">
          <MessageCircle
            className={`absolute inset-0 h-6 w-6 transition-all duration-300 ${isOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
          />
          <X
            className={`absolute inset-0 h-6 w-6 transition-all duration-300 ${isOpen ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}`}
          />
        </div>
      </button>
    </>
  )
}
