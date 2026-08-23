import {PortableText as BasePortableText, type PortableTextComponents} from '@portabletext/react'
import type {PortableTextBlock} from '@starter/commerce/types'

const components: PortableTextComponents = {
  block: {
    normal: ({children}) => <p className="mb-3 leading-relaxed">{children}</p>,
    h2: ({children}) => <h2 className="mb-2 mt-4 text-lg font-bold uppercase">{children}</h2>,
    h3: ({children}) => <h3 className="mb-2 mt-3 text-base font-bold uppercase">{children}</h3>,
    blockquote: ({children}) => (
      <blockquote className="my-3 border-l-2 border-swag-black pl-3 italic">{children}</blockquote>
    ),
  },
  marks: {
    link: ({children, value}) => (
      <a href={value?.href} className="underline underline-offset-2 hover:text-swag-orange">
        {children}
      </a>
    ),
  },
}

export function PortableText({value}: {value: PortableTextBlock[]}) {
  return <BasePortableText value={value as never} components={components} />
}
