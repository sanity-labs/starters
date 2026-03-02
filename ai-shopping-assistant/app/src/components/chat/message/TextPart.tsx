// Renders a single text part of a chat message as rich markdown.
// The rendering pipeline: remarkDirective (parses generic directives from markdown)
// → remarkDirectives (transforms them into <Document> nodes, see remarkDirectives.ts)
// → custom components below (renders Document, links, lists, etc.)

import Link from 'next/link'
import ReactMarkdown, {type Components} from 'react-markdown'
import remarkDirective from 'remark-directive'

import {cn} from '@/lib/utils'

import {Document} from './Document'
import {remarkDirectives} from './remarkDirectives'

interface TextPartProps {
  text: string
  isUser: boolean
}

type ExtendedComponents = Components & {
  Document: typeof Document
}

export function TextPart({text, isUser}: TextPartProps) {
  if (!text.trim()) return null

  const components: ExtendedComponents = {
    Document,

    a(props) {
      const {href = '', children} = props
      const isInternal = href.startsWith('/')
      const className = cn(
        'underline',
        isUser ? 'text-white/90 hover:text-white' : 'text-blue-600 hover:text-blue-700',
      )

      if (isInternal) {
        return (
          <Link href={href} className={className}>
            {children}
          </Link>
        )
      }

      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
          {children}
        </a>
      )
    },
    p: ({children}: {children?: React.ReactNode}) => (
      <p className="whitespace-pre-wrap">{children}</p>
    ),
    ul: ({children}: {children?: React.ReactNode}) => (
      <ul className="list-disc pl-4">{children}</ul>
    ),
    ol: (props) => <ol className="list-decimal pl-4">{props.children}</ol>,
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkDirective, remarkDirectives]} components={components}>
      {text}
    </ReactMarkdown>
  )
}
