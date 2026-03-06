import {describe, it, expect, vi, type Mock} from 'vitest'
import {defineType, defineField} from 'sanity'
import type {SanityClient} from '@sanity/client'
import {LOCALE_EXISTS_QUERY, validateLocaleCode, injectLanguageField} from './languageField'

// --- mock client ---

type MockSanityClient = SanityClient & {fetch: Mock}

function createMockClient(): MockSanityClient {
  return {fetch: vi.fn()} as unknown as MockSanityClient
}

// --- validateLocaleCode ---

describe('validateLocaleCode', () => {
  it('returns true for undefined (no value set)', async () => {
    const client = createMockClient()
    expect(await validateLocaleCode(undefined, client)).toBe(true)
    expect(client.fetch).not.toHaveBeenCalled()
  })

  it('returns true when the locale exists', async () => {
    const client = createMockClient()
    client.fetch.mockResolvedValue(true)
    expect(await validateLocaleCode('en-US', client)).toBe(true)
  })

  it('returns error string when the locale does not exist', async () => {
    const client = createMockClient()
    client.fetch.mockResolvedValue(false)
    expect(await validateLocaleCode('xx-XX', client)).toBe('"xx-XX" is not a configured locale')
  })

  it('passes the correct query and params to the client', async () => {
    const client = createMockClient()
    client.fetch.mockResolvedValue(true)
    await validateLocaleCode('de-DE', client)
    expect(client.fetch).toHaveBeenCalledWith(LOCALE_EXISTS_QUERY, {code: 'de-DE'})
  })
})

// --- injectLanguageField ---

const article = defineType({
  name: 'article',
  type: 'document',
  fields: [defineField({name: 'title', type: 'string'})],
})

const tag = defineType({
  name: 'tag',
  type: 'document',
  fields: [defineField({name: 'label', type: 'string'})],
})

const color = defineType({
  name: 'color',
  type: 'object',
  fields: [defineField({name: 'hex', type: 'string'})],
})

describe('injectLanguageField', () => {
  it('appends language field to matching document types', () => {
    const result = injectLanguageField(['article'])([article, tag])
    const injected = result.find((t) => t.name === 'article')!
    expect('fields' in injected && injected.fields?.some((f) => f.name === 'language')).toBe(true)
  })

  it('does not modify non-matching document types', () => {
    const result = injectLanguageField(['article'])([article, tag])
    const unchanged = result.find((t) => t.name === 'tag')!
    expect('fields' in unchanged && unchanged.fields?.some((f) => f.name === 'language')).toBe(
      false,
    )
  })

  it('skips non-document types even if name matches', () => {
    const result = injectLanguageField(['color'])([color])
    const unchanged = result.find((t) => t.name === 'color')!
    expect('fields' in unchanged && unchanged.fields?.some((f) => f.name === 'language')).toBe(
      false,
    )
  })

  it('preserves existing fields on injected types', () => {
    const result = injectLanguageField(['article'])([article])
    const injected = result.find((t) => t.name === 'article')!
    expect('fields' in injected && injected.fields?.some((f) => f.name === 'title')).toBe(true)
  })

  it('returns the same array length', () => {
    const result = injectLanguageField(['article'])([article, tag, color])
    expect(result).toHaveLength(3)
  })
})
