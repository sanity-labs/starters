import {describe, expect, it, vi} from 'vitest'

import {
  analyzeSource,
  buildTextExtracts,
  localeReason,
  parseAnalysisResponse,
} from './analyzeSource'

const SUBJECT = 'dataset:proj1:production:article-1'

const CURRENT_DOC = {
  _id: 'article-1',
  _rev: 'rev-2',
  _type: 'article',
  language: 'en-US',
  title: 'The Acme widget launches in 2026',
}

const HISTORICAL_DOC = {...CURRENT_DOC, _rev: 'rev-1', title: 'The Acme widget launches in 2025'}

const ANALYSIS = JSON.stringify({
  materiality: 'material',
  explanation: 'The launch year moved from 2025 to 2026.',
  suggestions: [
    {fieldName: 'title', explanation: 'The year changed.', recommendation: 'retranslate'},
  ],
})

const COSMETIC_ANALYSIS = JSON.stringify({
  materiality: 'cosmetic',
  explanation: 'Whitespace only.',
  suggestions: [{fieldName: 'title', explanation: '.', recommendation: 'dismiss'}],
})

const TRANSACTIONS = ['{"id":"rev-2","documentIDs":["article-1"]}', '{"id":"rev-1"}'].join('\n')

function harness(
  options: {
    analysis?: string
    analyzedRev?: null | string
    currentDoc?: null | Record<string, unknown>
    historicalDoc?: Record<string, unknown>
    localeCodes?: string[]
    perspective?: unknown
    settledEffectKeys?: string[]
    transactions?: string
    translations?: {language: string; ref: string}[]
  } = {},
) {
  const prompt = vi.fn().mockResolvedValue(options.analysis ?? ANALYSIS)

  const contentClient = {
    action: vi.fn(),
    agent: {action: {prompt, translate: vi.fn()}},
    create: vi.fn(),
    createIfNotExists: vi.fn(),
    createOrReplace: vi.fn(),
    fetch: vi.fn().mockImplementation((query: string) => {
      if (query.includes('l10n.locale')) {
        return Promise.resolve(options.localeCodes ?? ['en-US', 'de-DE', 'fr-FR'])
      }
      if (query.includes('translation.metadata')) {
        return Promise.resolve({
          translations: options.translations ?? [
            {language: 'en-US', ref: 'article-1'},
            {language: 'de-DE', ref: 'article-1-de'},
            {language: 'ja-JP', ref: 'article-1-ja'},
          ],
        })
      }
      return Promise.resolve(options.currentDoc === undefined ? CURRENT_DOC : options.currentDoc)
    }),
    getDocument: vi.fn(),
    patch: vi.fn(),
    request: vi.fn().mockImplementation((opts: {url?: string}) => {
      if (opts.url?.includes('/transactions/')) {
        return Promise.resolve(options.transactions ?? TRANSACTIONS)
      }
      return Promise.resolve({documents: [options.historicalDoc ?? HISTORICAL_DOC]})
    }),
    transaction: vi.fn(),
    withConfig: vi.fn(),
  }
  contentClient.withConfig.mockReturnValue(contentClient)

  const workflowClient = {
    create: vi.fn(),
    fetch: vi.fn().mockImplementation((query: string) => {
      if (query.includes('effectHistory')) return Promise.resolve(options.settledEffectKeys ?? [])
      if (query.includes('perspective')) return Promise.resolve(options.perspective ?? null)
      return Promise.resolve(options.analyzedRev ?? null)
    }),
    getDocument: vi.fn(),
    patch: vi.fn(),
    transaction: vi.fn(),
  }

  const ctx = {
    client: workflowClient,
    clientFor: vi.fn().mockReturnValue(contentClient),
    commitOps: vi.fn(),
    effectKey: 'effect-1',
    instanceId: 'instance-1',
    log: vi.fn(),
    setProgress: vi.fn(),
  }

  return {contentClient, ctx, prompt}
}

describe('analyze-source', () => {
  it('writes every completion op at workflow scope', async () => {
    const {ctx} = harness()

    const result = await analyzeSource({subject: SUBJECT}, ctx)

    expect(result).toEqual({
      ops: [
        {
          type: 'field.set',
          target: {scope: 'workflow', field: 'analyzedRev'},
          value: {type: 'literal', value: 'rev-2'},
        },
        {
          type: 'field.set',
          target: {scope: 'workflow', field: 'materiality'},
          value: {type: 'literal', value: 'material'},
        },
        {
          type: 'field.set',
          target: {scope: 'workflow', field: 'targetLocales'},
          value: {
            type: 'literal',
            value: [
              {locale: 'de-DE', reason: 'material change to title'},
              {locale: 'fr-FR', reason: 'missing translation'},
            ],
          },
        },
        {
          type: 'field.set',
          target: {scope: 'workflow', field: 'explanation'},
          value: {type: 'literal', value: 'The launch year moved from 2025 to 2026.'},
        },
      ],
    })
  })

  it('derives target locales in code — every configured locale but the source', async () => {
    const {ctx} = harness()

    const result = await analyzeSource({subject: SUBJECT}, ctx)

    // ja-JP has a translation but is no longer a configured locale, so it is
    // not a candidate; en-US is the source.
    expect(localesOf(result)).toEqual(['de-DE', 'fr-FR'])
  })

  it('emits no locales for a cosmetic change to a fully translated document', async () => {
    const {ctx} = harness({
      analysis: COSMETIC_ANALYSIS,
      localeCodes: ['en-US', 'de-DE'],
      translations: [
        {language: 'en-US', ref: 'article-1'},
        {language: 'de-DE', ref: 'article-1-de'},
      ],
    })

    const result = await analyzeSource({subject: SUBJECT}, ctx)

    expect(localesOf(result)).toEqual([])
    expect(materialityOf(result)).toBe('cosmetic')
  })

  it('still fans out to untranslated locales when the edit was only cosmetic', async () => {
    const {ctx} = harness({analysis: COSMETIC_ANALYSIS})

    const result = await analyzeSource({subject: SUBJECT}, ctx)

    expect(targetsOf(result)).toEqual([{locale: 'fr-FR', reason: 'missing translation'}])
    expect(materialityOf(result)).toBe('cosmetic')
  })

  it('diffs against the previous published revision on a first pass', async () => {
    const {contentClient, ctx} = harness()

    await analyzeSource({subject: SUBJECT}, ctx)

    expect(contentClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/data/history/production/transactions/article-1'),
        json: false,
      }),
    )
    expect(contentClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/data/history/production/documents/article-1?revision=rev-1',
      }),
    )
  })

  it('diffs against analyzedRev when the run has already analyzed once', async () => {
    const {contentClient, ctx} = harness({analyzedRev: 'rev-0'})

    await analyzeSource({subject: SUBJECT}, ctx)

    const urls = contentClient.request.mock.calls.map(([opts]) => opts.url)
    expect(urls).toEqual(['/data/history/production/documents/article-1?revision=rev-0'])
  })

  it('fans out to every locale on a first publish, without an AI call', async () => {
    const {ctx, prompt} = harness({
      transactions: '{"id":"rev-2"}',
      translations: [{language: 'en-US', ref: 'article-1'}],
    })

    const result = await analyzeSource({subject: SUBJECT}, ctx)

    expect(prompt).not.toHaveBeenCalled()
    expect(materialityOf(result)).toBe('material')
    expect(targetsOf(result)).toEqual([
      {locale: 'de-DE', reason: 'missing translation'},
      {locale: 'fr-FR', reason: 'missing translation'},
    ])
  })

  it('reports cosmetic without an AI call when there is nothing to diff and nothing missing', async () => {
    const {ctx, prompt} = harness({
      localeCodes: ['en-US', 'de-DE'],
      transactions: '{"id":"rev-2"}',
      translations: [
        {language: 'en-US', ref: 'article-1'},
        {language: 'de-DE', ref: 'article-1-de'},
      ],
    })

    const result = await analyzeSource({subject: SUBJECT}, ctx)

    expect(prompt).not.toHaveBeenCalled()
    expect(materialityOf(result)).toBe('cosmetic')
    expect(localesOf(result)).toEqual([])
  })

  it('picks up untranslated locales without an AI call when nothing actually changed', async () => {
    const {ctx, prompt} = harness({currentDoc: {...HISTORICAL_DOC, _rev: 'rev-2'}})

    const result = await analyzeSource({subject: SUBJECT}, ctx)

    expect(prompt).not.toHaveBeenCalled()
    expect(materialityOf(result)).toBe('material')
    expect(localesOf(result)).toEqual(['fr-FR'])
  })

  it('short-circuits a redelivery whose effect key already settled', async () => {
    const {ctx, prompt} = harness({settledEffectKeys: ['effect-1']})

    const result = await analyzeSource({subject: SUBJECT}, ctx)

    expect(result).toBeUndefined()
    expect(prompt).not.toHaveBeenCalled()
  })

  it('routes content reads through the subject resource', async () => {
    const {ctx} = harness()

    await analyzeSource({subject: SUBJECT}, ctx)

    expect(ctx.clientFor).toHaveBeenCalledWith(SUBJECT)
  })

  it('rejects a subject that is not a GDR', async () => {
    const {ctx} = harness()

    await expect(analyzeSource({subject: 'article-1'}, ctx)).rejects.toThrow(/must be a GDR URI/)
  })

  it('reads the subject under the perspective the run was started with', async () => {
    const {contentClient, ctx} = harness({perspective: 'published'})

    await analyzeSource({subject: SUBJECT}, ctx)

    // The `source-changed` trigger compares `analyzedRev` with the revision the
    // engine hydrates, so this read has to be the same layer the engine reads.
    expect(contentClient.fetch).toHaveBeenCalledWith(
      '*[_id == $id][0]',
      {id: 'article-1'},
      {perspective: 'published', tag: 'get-source-doc'},
    )
  })

  it('falls back to the engine’s drafts default when the run has no perspective', async () => {
    const {contentClient, ctx} = harness()

    await analyzeSource({subject: SUBJECT}, ctx)

    expect(contentClient.fetch).toHaveBeenCalledWith(
      '*[_id == $id][0]',
      {id: 'article-1'},
      {perspective: 'drafts', tag: 'get-source-doc'},
    )
  })
})

describe('analyze-source, field tier', () => {
  const PERSON_SUBJECT = 'dataset:proj1:production:person-1'

  function entry(language: string, value: string) {
    return {_key: `${language}-k`, _type: 'internationalizedArrayTextValue', language, value}
  }

  function person(bio: unknown[], seo: Record<string, unknown> = {}) {
    return {
      _id: 'person-1',
      _rev: 'rev-2',
      _type: 'person',
      name: 'Ada Lovelace',
      bio,
      seo: {
        _type: 'seo',
        metaTitle: [entry('en-US', 'Ada')],
        metaDescription: [entry('en-US', 'About Ada')],
        ...seo,
      },
    }
  }

  const ENGLISH_ONLY = person([entry('en-US', 'Ada writes about Acme.')])

  function personHarness(options: Parameters<typeof harness>[0] = {}) {
    return harness({
      currentDoc: ENGLISH_ONLY,
      historicalDoc: ENGLISH_ONLY,
      perspective: 'published',
      transactions: ['{"id":"rev-2","documentIDs":["person-1"]}', '{"id":"rev-1"}'].join('\n'),
      ...options,
    })
  }

  function targetLocales(result: unknown) {
    if (typeof result !== 'object' || result === null || !('ops' in result)) return undefined
    const ops = result.ops
    if (!Array.isArray(ops)) return undefined
    return ops.find((op) => op?.target?.field === 'targetLocales')?.value?.value
  }

  it('derives coverage from the arrays, not the join document', async () => {
    const {contentClient, ctx} = personHarness()

    const result = await analyzeSource({subject: PERSON_SUBJECT}, ctx)

    // Nothing is translated yet, so every configured locale needs a run — even
    // though the join document happens to name de-DE for the article fixture.
    expect(targetLocales(result)).toEqual([
      {locale: 'de-DE', reason: 'missing translation'},
      {locale: 'fr-FR', reason: 'missing translation'},
    ])
    expect(contentClient.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('translation.metadata'),
      expect.anything(),
      expect.anything(),
    )
  })

  it('counts a locale as covered only when every field carries it', async () => {
    const half = person(
      [entry('en-US', 'Ada writes about Acme.'), entry('de-DE', 'Ada schreibt.')],
      {metaTitle: [entry('en-US', 'Ada'), entry('de-DE', 'Ada')]},
    )
    const {ctx} = personHarness({currentDoc: half, historicalDoc: half})

    const result = await analyzeSource({subject: PERSON_SUBJECT}, ctx)

    // de-DE has a bio and a meta title but no meta description.
    expect(targetLocales(result)).toContainEqual({locale: 'de-DE', reason: 'missing translation'})
  })

  it('does not re-run a locale that every field already covers', async () => {
    const full = person(
      [entry('en-US', 'Ada writes about Acme.'), entry('de-DE', 'Ada schreibt.')],
      {
        metaTitle: [entry('en-US', 'Ada'), entry('de-DE', 'Ada')],
        metaDescription: [entry('en-US', 'About Ada'), entry('de-DE', 'Über Ada')],
      },
    )
    const {ctx} = personHarness({currentDoc: full, historicalDoc: full})

    const result = await analyzeSource({subject: PERSON_SUBJECT}, ctx)

    expect(targetLocales(result)).toEqual([{locale: 'fr-FR', reason: 'missing translation'}])
  })

  it('reads an added translation as no change at all', async () => {
    // The self-diff loop: publishing an approved run adds de-DE entries to the
    // subject. Diffing whole documents would call that material and start the
    // whole run again on the next publish.
    const withGerman = person(
      [entry('en-US', 'Ada writes about Acme.'), entry('de-DE', 'Ada schreibt.')],
      {
        metaTitle: [entry('en-US', 'Ada'), entry('de-DE', 'Ada')],
        metaDescription: [entry('en-US', 'About Ada'), entry('de-DE', 'Über Ada')],
      },
    )
    const {ctx, prompt} = personHarness({currentDoc: withGerman, historicalDoc: ENGLISH_ONLY})

    const result = await analyzeSource({subject: PERSON_SUBJECT}, ctx)

    // No changed field, so no AI call and no retranslation of a covered locale.
    expect(prompt).not.toHaveBeenCalled()
    expect(targetLocales(result)).toEqual([{locale: 'fr-FR', reason: 'missing translation'}])
  })

  it('still sees a real edit to the source-locale text', async () => {
    const edited = person([entry('en-US', 'Ada writes about Acme in 2026.')])
    const {ctx, prompt} = personHarness({
      analysis: JSON.stringify({
        materiality: 'material',
        explanation: 'The bio changed.',
        suggestions: [{fieldName: 'bio', explanation: 'Reworded.', recommendation: 'retranslate'}],
      }),
      currentDoc: edited,
      historicalDoc: ENGLISH_ONLY,
    })

    await analyzeSource({subject: PERSON_SUBJECT}, ctx)

    // The field summary is built from the projection, so it names the field by
    // its dot path rather than by the array it lives in.
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(prompt.mock.calls[0][0].instruction).toContain('bio')
  })

  it('ignores a change to a field that is not localized', async () => {
    const renamed = {...ENGLISH_ONLY, name: 'Augusta Ada King'}
    const {ctx, prompt} = personHarness({currentDoc: renamed, historicalDoc: ENGLISH_ONLY})

    await analyzeSource({subject: PERSON_SUBJECT}, ctx)

    expect(prompt).not.toHaveBeenCalled()
  })
})

describe('parseAnalysisResponse', () => {
  const fields = new Set(['title'])

  it('strips markdown fences', () => {
    const raw = '```json\n{"materiality":"minor","explanation":"x","suggestions":[]}\n```'
    expect(parseAnalysisResponse(raw, fields).materiality).toBe('minor')
  })

  it('drops suggestions naming fields that did not change', () => {
    const raw = JSON.stringify({
      materiality: 'material',
      explanation: 'x',
      suggestions: [
        {fieldName: 'title', explanation: 'a', recommendation: 'retranslate'},
        {fieldName: 'invented', explanation: 'b', recommendation: 'retranslate'},
      ],
    })

    const result = parseAnalysisResponse(raw, fields)

    expect(result.suggestions.map((s) => s.fieldName)).toEqual(['title'])
    expect(result.droppedSuggestionCount).toBe(1)
  })

  it('rejects a materiality outside the closed list', () => {
    const raw = JSON.stringify({materiality: 'urgent', explanation: 'x', suggestions: []})
    expect(() => parseAnalysisResponse(raw, fields)).toThrow(/Invalid materiality/)
  })

  it('rejects a response with no explanation', () => {
    const raw = JSON.stringify({materiality: 'minor', suggestions: []})
    expect(() => parseAnalysisResponse(raw, fields)).toThrow(/explanation/)
  })

  it('treats any non-retranslate recommendation as dismiss', () => {
    const raw = JSON.stringify({
      materiality: 'minor',
      explanation: 'x',
      suggestions: [{fieldName: 'title', explanation: 'a', recommendation: 'maybe'}],
    })

    expect(parseAnalysisResponse(raw, fields).suggestions[0]?.recommendation).toBe('dismiss')
  })
})

describe('buildTextExtracts', () => {
  it('extracts old and new text for changed Portable Text fields only', () => {
    const extracts = buildTextExtracts([
      {
        fieldName: 'body',
        changed: true,
        magnitude: 'updated',
        fieldType: 'portableText',
        oldValue: [{_type: 'block', children: [{_type: 'span', text: 'before'}]}],
        newValue: [{_type: 'block', children: [{_type: 'span', text: 'after'}]}],
      },
      {
        fieldName: 'intro',
        changed: false,
        magnitude: 'unchanged',
        fieldType: 'portableText',
        oldValue: [],
        newValue: [],
      },
      {fieldName: 'title', changed: true, magnitude: 'minor', fieldType: 'string'},
    ])

    expect(extracts).toEqual({body: {oldText: 'before', newText: 'after'}})
  })
})

describe('localeReason', () => {
  it('names the fields the analysis wants retranslated', () => {
    const reason = localeReason({
      materiality: 'material',
      explanation: 'x',
      suggestions: [
        {fieldName: 'title', explanation: '', recommendation: 'retranslate'},
        {fieldName: 'body', explanation: '', recommendation: 'retranslate'},
        {fieldName: 'slug', explanation: '', recommendation: 'dismiss'},
      ],
    })

    expect(reason).toBe('material change to title, body')
  })

  it('falls back to the document when no field is singled out', () => {
    const reason = localeReason({materiality: 'minor', explanation: 'x', suggestions: []})
    expect(reason).toBe('minor change to the source document')
  })
})

function opValue(result: unknown, field: string): unknown {
  if (typeof result !== 'object' || result === null || !('ops' in result)) return undefined
  const {ops} = result
  if (!Array.isArray(ops)) return undefined
  for (const op of ops) {
    if (op.target?.field === field) return op.value?.value
  }
  return undefined
}

function targetsOf(result: unknown): unknown {
  return opValue(result, 'targetLocales')
}

function localesOf(result: unknown): unknown {
  const value = targetsOf(result)
  return Array.isArray(value) ? value.map((row) => row.locale) : value
}

function materialityOf(result: unknown): unknown {
  return opValue(result, 'materiality')
}
