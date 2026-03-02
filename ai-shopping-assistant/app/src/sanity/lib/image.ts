import {createImageUrlBuilder} from '@sanity/image-url'

import {client} from './client'

const builder = createImageUrlBuilder(client)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function urlFor(source: any) {
  return builder.image(source)
}
