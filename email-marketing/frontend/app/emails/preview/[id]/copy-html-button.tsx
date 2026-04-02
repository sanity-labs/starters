'use client'

import {useState} from 'react'

export default function CopyHtmlButton({html}: {html: string}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(html)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
    >
      {copied ? 'Copied!' : 'Copy HTML'}
    </button>
  )
}
