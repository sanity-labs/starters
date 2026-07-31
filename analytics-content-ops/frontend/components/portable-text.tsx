import Image from 'next/image'
import {
  PortableText as PortableTextComponent,
  type PortableTextComponents,
  type PortableTextBlock,
} from '@portabletext/react'
import {urlFor} from '@/sanity/image'

const components: PortableTextComponents = {
  block: {
    normal: ({children}) => (
      <p className="text-pretty text-base leading-relaxed text-foreground/90">{children}</p>
    ),
    h2: ({children}) => (
      <h2 className="mt-10 font-serif text-2xl font-medium tracking-tight text-foreground">
        {children}
      </h2>
    ),
    h3: ({children}) => (
      <h3 className="mt-8 font-serif text-xl font-medium tracking-tight text-foreground">
        {children}
      </h3>
    ),
    blockquote: ({children}) => (
      <blockquote className="border-l-2 border-primary pl-5 font-serif text-xl italic leading-relaxed text-foreground">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({children}) => (
      <ul className="list-disc space-y-2 pl-5 text-foreground/90">{children}</ul>
    ),
    number: ({children}) => (
      <ol className="list-decimal space-y-2 pl-5 text-foreground/90">{children}</ol>
    ),
  },
  marks: {
    link: ({children, value}) => (
      <a
        href={value?.href}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-primary underline underline-offset-2"
      >
        {children}
      </a>
    ),
  },
  types: {
    image: ({value}) => {
      if (!value?.asset) return null
      return (
        <figure className="my-8">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-sm bg-muted">
            <Image
              src={urlFor(value).width(1200).url()}
              alt={value.alt || ''}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
          {value.caption && (
            <figcaption className="mt-2 text-center text-xs text-muted-foreground">
              {value.caption}
            </figcaption>
          )}
        </figure>
      )
    },
  },
}

export function PortableText({value}: {value: PortableTextBlock[]}) {
  return (
    <div className="article-body space-y-6">
      <PortableTextComponent value={value} components={components} />
    </div>
  )
}
