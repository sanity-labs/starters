import type {ComponentProps} from 'react'
import {PortableText as PortableTextReact} from '@portabletext/react'

export function Body({value}: {value: ComponentProps<typeof PortableTextReact>['value']}) {
  return <PortableTextReact value={value} />
}
