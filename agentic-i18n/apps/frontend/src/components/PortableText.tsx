import {PortableText as PortableTextReact} from '@portabletext/react'

export function Body({value}: {value: any[]}) {
  return <PortableTextReact value={value} />
}
