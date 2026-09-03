import {portableTextToMarkdown, type PortableTextRenderers} from '@portabletext/markdown'
import type {TypedObject} from '@portabletext/types'
import imageUrlBuilder from '@sanity/image-url'
import type {SanityClient} from '@sanity/client'
import {fenceFor} from './fence'
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
 *   schema survives into the markdown. The fence is sized to the code
 *   (see fenceFor), so a snippet that itself contains ``` stays inside
 *   the block.
 */
export function createConverter(client: SanityClient) {
  const builder = imageUrlBuilder(client)

  const renderers: Partial<PortableTextRenderers> = {
    types: {
      code: ({value}: {value: CodeBlock}) => {
        const {language = '', filename, code} = value
        const lang = filename ? `${language}:${filename}` : language
        const fence = fenceFor(code)
        return `${fence}${lang}\n${code}\n${fence}`
      },
      image: ({value}: {value: ImageBlock}) => {
        const url = builder.image(value.asset).url()
        const caption = value.caption ? `\n\n*${value.caption}*` : ''
        return `![${value.alt || ''}](${url})${caption}`
      },
      callout: ({value}: {value: CalloutBlock}) => {
        const style = value.style || 'note'
        // Recurse with the same renderers so blocks nested in the callout
        // keep their custom output instead of falling back to the defaults.
        const content = portableTextToMarkdown(value.content, renderers)
        return `> [!${style.toUpperCase()}]\n> ${content.replace(/\n/g, '\n> ')}`
      },
    },
  }

  return function convertToMarkdown(blocks: TypedObject[]): string {
    return portableTextToMarkdown(blocks, renderers)
  }
}
