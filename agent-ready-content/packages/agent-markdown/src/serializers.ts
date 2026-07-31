import {portableTextToMarkdown} from '@portabletext/markdown'
import type {TypedObject} from '@portabletext/types'
import imageUrlBuilder from '@sanity/image-url'
import type {SanityClient} from '@sanity/client'
import type {CalloutBlock, CodeBlock, ImageBlock} from './types'

/**
 * Portable Text to markdown via @portabletext/markdown. Standard blocks
 * (paragraphs, headings, lists, marks, links) convert without
 * configuration; the custom block types in @agent-ready/schema get a
 * renderer each.
 *
 * Two deliberate choices:
 * - Callouts become GitHub Flavored Markdown alerts (> [!WARNING]),
 *   the dialect agents see most in training data and working repos.
 * - Code fences carry the filename in the info string
 *   (```typescript:src/lib/example.ts), so structure modeled in the
 *   schema survives into the markdown.
 */
export function createConverter(client: SanityClient) {
  const builder = imageUrlBuilder(client)

  return function convertToMarkdown(blocks: TypedObject[]): string {
    return portableTextToMarkdown(blocks, {
      types: {
        code: ({value}: {value: CodeBlock}) => {
          const {language = '', filename, code} = value
          const lang = filename ? `${language}:${filename}` : language
          return `\`\`\`${lang}\n${code}\n\`\`\``
        },
        image: ({value}: {value: ImageBlock}) => {
          const url = builder.image(value.asset).url()
          const caption = value.caption ? `\n\n*${value.caption}*` : ''
          return `![${value.alt || ''}](${url})${caption}`
        },
        callout: ({value}: {value: CalloutBlock}) => {
          const style = value.style || 'note'
          const content = portableTextToMarkdown(value.content)
          return `> [!${style.toUpperCase()}]\n> ${content.replace(/\n/g, '\n> ')}`
        },
      },
    })
  }
}
