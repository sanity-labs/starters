'use client'

import {useState} from 'react'

type CopyState = 'idle' | 'copied' | 'error'

/**
 * Fetches the markdown version of the current page and copies it to
 * the clipboard. Progressive enhancement: the .md URL works without
 * this button; the button saves a round trip through the URL bar.
 */
export function CopyMarkdown({path}: {path: string}) {
  const [state, setState] = useState<CopyState>('idle')

  async function copy() {
    try {
      const response = await fetch(path)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await navigator.clipboard.writeText(await response.text())
      setState('copied')
    } catch {
      setState('error')
    } finally {
      setTimeout(() => setState('idle'), 2000)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      style={{fontSize: '0.8125rem', padding: '0.25rem 0.75rem', cursor: 'pointer'}}
    >
      {state === 'idle' && 'Copy as markdown'}
      {state === 'copied' && 'Copied'}
      {state === 'error' && 'Copy failed'}
    </button>
  )
}
