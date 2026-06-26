import {createQueryStore, type QueryStore} from '@sanity/core-loader'
import type {SanityClient} from '@sanity/client'

let queryStore: QueryStore | undefined

export function getQueryStore(client: SanityClient): QueryStore {
  if (!queryStore) {
    queryStore = createQueryStore({client})
  }
  return queryStore
}
