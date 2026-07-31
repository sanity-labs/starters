import type {PortableTextComponents} from '@portabletext/react'
import imageUrlBuilder from '@sanity/image-url'
import {client} from '@/sanity/client'

const builder = imageUrlBuilder(client)

/** HTML renderers for the custom block types in @agent-ready/schema. */
export const components: PortableTextComponents = {
  types: {
    code: ({value}) => (
      <figure style={{margin: '1rem 0'}}>
        {value.filename && (
          <figcaption style={{fontSize: '0.75rem', fontFamily: 'monospace'}}>
            {value.filename}
          </figcaption>
        )}
        <pre style={{background: '#f4f4f4', padding: '1rem', overflowX: 'auto'}}>
          <code>{value.code}</code>
        </pre>
      </figure>
    ),
    image: ({value}) => (
      <figure style={{margin: '1rem 0'}}>
        <img
          src={builder.image(value.asset).width(1200).url()}
          alt={value.alt || ''}
          style={{maxWidth: '100%'}}
        />
        {value.caption && <figcaption>{value.caption}</figcaption>}
      </figure>
    ),
    callout: ({value}) => (
      <aside
        style={{
          borderLeft: '4px solid #888',
          padding: '0.5rem 1rem',
          margin: '1rem 0',
          background: '#fafafa',
        }}
      >
        <strong style={{textTransform: 'uppercase', fontSize: '0.75rem'}}>
          {value.style || 'note'}
        </strong>
        <PortableTextInner value={value.content} />
      </aside>
    ),
  },
}

// Nested Portable Text inside callouts
import {PortableText} from '@portabletext/react'
function PortableTextInner({value}: {value: any}) {
  return <PortableText value={value} />
}
