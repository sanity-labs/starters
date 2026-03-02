import {LaunchIcon} from '@sanity/icons'
import {type DocumentHandle} from '@sanity/sdk-react'
import {Button} from '@sanity/ui'

type OpenInStudioButtonProps = {
  doc: DocumentHandle
  mode?: 'bleed' | 'default' | 'ghost'
  size?: number
  text?: boolean
  title?: string
}

/**
 * Build a Studio URL that opens the document with the translations inspector pane.
 *
 * URL format: {studioBase}/structure/{docType};{docId},inspect=translations
 *
 * The studio base URL is resolved in order:
 * 1. SANITY_APP_STUDIO_URL env var (for production — set to your deployed studio hostname,
 *    e.g. "https://my-company.sanity.studio" or a custom domain)
 * 2. In development (import.meta.env.DEV), defaults to http://localhost:3333
 */
export function getStudioDocumentUrl(doc: DocumentHandle): string {
  // Strip drafts./versions. prefix
  let docId = doc.documentId
  if (docId.startsWith('drafts.')) docId = docId.slice(7)
  if (docId.startsWith('versions.')) {
    const parts = docId.split('.')
    docId = parts.slice(2).join('.')
  }

  const studioBase = import.meta.env.SANITY_APP_STUDIO_URL
    ? import.meta.env.SANITY_APP_STUDIO_URL.replace(/\/$/, '')
    : import.meta.env.DEV
      ? 'http://localhost:3333'
      : ''

  // Open the document in the structure tool with the translations inspector pane
  return `${studioBase}/structure/${doc.documentType};${encodeURIComponent(`${docId},inspect=translations`)}`
}

function OpenInStudioButton({doc, mode = 'bleed', size = 2, text, title}: OpenInStudioButtonProps) {
  const handleClick = () => {
    const url = getStudioDocumentUrl(doc)
    if (!url) return
    window.open(url, '_blank')
  }

  if (text) {
    return (
      <span
        className="cursor-pointer hover:bg-gray-50/50 transition-all duration-200 hover:shadow-[0_2px_0_0_rgba(59,130,246,0.5)]"
        onClick={handleClick}
      >
        {title}
      </span>
    )
  }

  return (
    <Button
      className="cursor-pointer hover:bg-gray-50/50 transition-all duration-200 hover:shadow-[0_2px_0_0_rgba(59,130,246,0.5)]"
      fontSize={size === 0 ? 0 : 1}
      icon={LaunchIcon}
      mode={mode}
      onClick={handleClick}
      padding={size}
      title={title || 'Open in Studio'}
    />
  )
}

export default OpenInStudioButton
