import {toHTML} from '@portabletext/to-html'
import imageUrlBuilder from '@sanity/image-url'
import type {Article} from '@agent-ready/markdown'
import {client} from './client'

const builder = imageUrlBuilder(client)

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** HTML renderers for the custom block types, mirroring the Next.js app. */
export function renderContent(content: Article['content']): string {
  return toHTML(content ?? [], {
    components: {
      types: {
        code: ({value}) =>
          `<figure>${value.filename ? `<figcaption><code>${escapeHtml(value.filename)}</code></figcaption>` : ''}<pre><code>${escapeHtml(value.code)}</code></pre></figure>`,
        image: ({value}) =>
          `<figure><img src="${builder.image(value.asset).width(1200).url()}" alt="${escapeHtml(value.alt || '')}" />${value.caption ? `<figcaption>${escapeHtml(value.caption)}</figcaption>` : ''}</figure>`,
        callout: ({value}) =>
          `<aside class="callout callout-${value.style || 'note'}"><strong>${(value.style || 'note').toUpperCase()}</strong>${toHTML(value.content)}</aside>`,
      },
    },
  })
}
