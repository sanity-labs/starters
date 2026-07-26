import {describe, it, expect, vi} from 'vitest'
import {createClient, type SanityClient} from '@sanity/client'
import type {SanityDocument} from 'sanity'
import {SLUG_UNIQUE_QUERY, isUniqueOtherThanLanguage} from './isUniqueOtherThanLanguage'

/** A real client with only `fetch` stubbed: the validator never reaches the network. */
function createMockClient(result = true) {
  const client = createClient({projectId: 'p', dataset: 'd', apiVersion: '2025-03-11'})
  const fetch = vi.fn().mockResolvedValue(result)
  client.fetch = fetch
  return {client, fetch}
}

function createContext(document: SanityDocument | undefined, client: SanityClient) {
  return {document, getClient: () => client}
}

function createDocument(_id: string, language?: string): SanityDocument {
  return {
    _id,
    _type: 'article',
    _rev: 'rev',
    _createdAt: '2026-01-01T00:00:00Z',
    _updatedAt: '2026-01-01T00:00:00Z',
    ...(language && {language}),
  }
}

describe('isUniqueOtherThanLanguage', () => {
  it('returns true without querying when the document has no language', async () => {
    const {client, fetch} = createMockClient()
    const context = createContext(createDocument('article-1'), client)
    expect(await isUniqueOtherThanLanguage('getting-started', context)).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns true without querying when there is no document', async () => {
    const {client, fetch} = createMockClient()
    const context = createContext(undefined, client)
    expect(await isUniqueOtherThanLanguage('getting-started', context)).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('passes a published id through unchanged', async () => {
    const {client, fetch} = createMockClient()
    const context = createContext(createDocument('article-1', 'en-US'), client)
    await isUniqueOtherThanLanguage('getting-started', context)
    expect(fetch).toHaveBeenCalledWith(
      SLUG_UNIQUE_QUERY,
      {id: 'article-1', language: 'en-US', slug: 'getting-started'},
      {tag: 'validation.slug-unique'},
    )
  })

  it('strips a drafts. prefix so a draft excludes its published counterpart', async () => {
    const {client, fetch} = createMockClient()
    const context = createContext(createDocument('drafts.article-1', 'en-US'), client)
    await isUniqueOtherThanLanguage('getting-started', context)
    expect(fetch.mock.calls[0][1]).toEqual({
      id: 'article-1',
      language: 'en-US',
      slug: 'getting-started',
    })
  })

  it('strips a versions. prefix so a release version excludes its own family', async () => {
    const {client, fetch} = createMockClient()
    const context = createContext(createDocument('versions.rSpring.article-1', 'de-DE'), client)
    await isUniqueOtherThanLanguage('getting-started', context)
    expect(fetch.mock.calls[0][1]).toEqual({
      id: 'article-1',
      language: 'de-DE',
      slug: 'getting-started',
    })
  })

  it('returns the query result when another document in the same language holds the slug', async () => {
    const {client} = createMockClient(false)
    const context = createContext(createDocument('article-1', 'en-US'), client)
    expect(await isUniqueOtherThanLanguage('getting-started', context)).toBe(false)
  })
})
