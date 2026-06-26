import {createClient as createSanityClient, type SanityClient} from '@sanity/client'
import {inject, Injectable, PLATFORM_ID, REQUEST, TransferState} from '@angular/core'
import {isPlatformBrowser} from '@angular/common'
import {DRAFT_MODE_KEY} from '../app.config'
import {PUBLIC_ENV} from '../env/public-env.token'
import {
  cookiesFromRequest,
  getPerspectiveFromCookies,
  isDraftModeBrowser,
  isDraftModeRequest,
} from './draft-mode.shared'
import {getQueryStore} from './query-store'
import {allPostsQuery, postBySlugQuery, postSlugsQuery, settingsQuery} from './queries'
import {SERVER_ENV} from './server-env.token'
import {ensureLiveMode} from './visual-editing'

export type PostListItem = {
  _id: string
  title: string
  slug: string
  excerpt?: string
  publishedAt?: string
  coverImage?: {asset?: {_ref: string}}
}

export type PostDetail = PostListItem & {
  body?: unknown
  author?: {name?: string; slug?: string; image?: {asset?: {_ref: string}}}
}

export type SiteSettings = {
  logo?: {asset?: {_ref: string}}
  title?: string
  description?: string
}

@Injectable({providedIn: 'root'})
export class SanityService {
  private readonly platformId = inject(PLATFORM_ID)
  private readonly publicEnv = inject(PUBLIC_ENV)
  private readonly serverEnv = inject(SERVER_ENV, {optional: true})
  private readonly transferState = inject(TransferState)
  private readonly request = inject(REQUEST, {optional: true})

  private isBrowserDraft(): boolean {
    return this.transferState.get(DRAFT_MODE_KEY, false) || isDraftModeBrowser()
  }

  private getDraftContext(): {draft: boolean; token?: string; perspective?: string} {
    if (isPlatformBrowser(this.platformId)) {
      const draft = this.isBrowserDraft()
      return {draft, perspective: draft ? 'drafts' : undefined}
    }

    const cookies = cookiesFromRequest(this.request)
    const draft = isDraftModeRequest(cookies)
    return {
      draft,
      token: draft ? this.serverEnv?.readToken : undefined,
      perspective: draft ? (getPerspectiveFromCookies(cookies) ?? 'drafts') : undefined,
    }
  }

  createClient(): SanityClient {
    const {draft, token, perspective} = this.getDraftContext()
    const client = createSanityClient({
      projectId: this.publicEnv.projectId,
      dataset: this.publicEnv.dataset,
      apiVersion: '2025-03-01',
      useCdn: !draft,
      token,
      perspective: perspective as 'drafts' | 'published' | undefined,
      stega: {
        enabled: draft,
        studioUrl: this.publicEnv.studioUrl,
      },
    })

    if (isPlatformBrowser(this.platformId) && draft) {
      ensureLiveMode(client, this.transferState)
    }

    return client
  }

  watchQuery<T>(
    query: string,
    params: Record<string, unknown>,
    onUpdate: (data: T) => void,
  ): () => void {
    const client = this.createClient()
    const {draft} = this.getDraftContext()

    if (isPlatformBrowser(this.platformId) && draft) {
      const $fetch = getQueryStore(client).createFetcherStore<T>(query, params)
      return $fetch.subscribe((state) => {
        if (state.data !== undefined) onUpdate(state.data)
      })
    }

    void client.fetch<T>(query, params).then(onUpdate)
    return () => undefined
  }

  getSettings(): Promise<SiteSettings | null> {
    return this.createClient().fetch(settingsQuery)
  }

  getPosts(): Promise<PostListItem[]> {
    return this.createClient().fetch(allPostsQuery)
  }

  getPost(slug: string): Promise<PostDetail | null> {
    return this.createClient().fetch(postBySlugQuery, {slug})
  }

  getPostSlugs(): Promise<{slug: string}[]> {
    return this.createClient().fetch(postSlugsQuery)
  }
}
