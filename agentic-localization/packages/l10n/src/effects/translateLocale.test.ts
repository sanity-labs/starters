import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {Glossary, StyleGuide} from '../prompts/promptAssembly'

vi.mock('../prompts/promptAssembly', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../prompts/promptAssembly')>()
  return {...actual, buildTranslateParams: vi.fn(actual.buildTranslateParams)}
})

import {buildTranslateParams} from '../prompts/promptAssembly'
import {translateLocale} from './translateLocale'

const SOURCE = 'dataset:proj1:production:article-1'
const RELEASE = {
  id: 'dataset:proj1:production:_.releases.summer',
  type: 'system.release',
  releaseName: 'summer',
}

const SOURCE_DOC = {
  _id: 'article-1',
  _rev: 'rev-2',
  _type: 'article',
  language: 'en-US',
  title: 'The Acme widget launch',
  audioSummary: {_type: 'file'},
}

const GLOSSARY: Glossary = {
  title: 'Brand terms',
  sourceLocale: {code: 'en-US', title: 'English'},
  entries: [
    {
      term: 'Acme',
      status: 'approved',
      doNotTranslate: null,
      partOfSpeech: 'noun',
      definition: null,
      context: null,
      translations: [{locale: 'de-DE', translation: 'Acme', gender: null}],
    },
  ],
}

const STYLE_GUIDE: StyleGuide = {
  title: 'German house style',
  locale: {code: 'de-DE', title: 'German'},
  formality: 'formal',
  tone: ['warm'],
  additionalInstructions: null,
}

const TRANSLATED = {_id: 'drafts.article-1-de', _type: 'article', title: 'Der Acme Widget Start'}

/** What each write path reports the machine output landed at. */
const DRAFT_REV = 'rev-draft-de'
const VERSION_REV = 'rev-version-de'
const ENTRIES_REV = 'rev-entries-de'

/**
 * Records the patch chain `tx.patch(id, (p) => …)` builds, so a test can assert
 * both what was written and in what order.
 */
function patchRecorder() {
  const calls: [string, unknown][] = []
  const builder = {
    append: (path: string, items: unknown[]) => {
      calls.push(['append', {path, items}])
      return builder
    },
    setIfMissing: (props: unknown) => {
      calls.push(['setIfMissing', props])
      return builder
    },
    unset: (paths: string[]) => {
      calls.push(['unset', paths])
      return builder
    },
  }
  return {builder, calls}
}

function harness(
  options: {
    settledEffectKeys?: string[]
    sourceDoc?: Record<string, unknown>
    perspective?: unknown
    translated?: unknown
    translations?: unknown[] | null
  } = {},
) {
  const sourceDoc = options.sourceDoc ?? SOURCE_DOC
  const translate = vi.fn().mockResolvedValue(options.translated ?? TRANSLATED)
  const {builder, calls: patchCalls} = patchRecorder()

  const tx = {
    commit: vi.fn().mockResolvedValue({}),
    createIfNotExists: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  }
  tx.createIfNotExists.mockReturnValue(tx)
  tx.patch.mockImplementation((_id: string, build: (p: typeof builder) => unknown) => {
    build(builder)
    return tx
  })

  const contentClient = {
    action: vi.fn().mockResolvedValue({transactionId: VERSION_REV}),
    agent: {action: {prompt: vi.fn(), translate}},
    create: vi.fn(),
    createIfNotExists: vi.fn(),
    createOrReplace: vi.fn().mockResolvedValue({_rev: DRAFT_REV}),
    fetch: vi.fn().mockImplementation((query: string) => {
      if (query.includes('._rev')) return Promise.resolve(ENTRIES_REV)
      if (query.includes('l10n.glossary')) return Promise.resolve([GLOSSARY])
      if (query.includes('l10n.styleGuide')) return Promise.resolve(STYLE_GUIDE)
      if (query.includes('l10n.locale')) {
        return Promise.resolve([
          {code: 'de-DE', title: 'German'},
          {code: 'en-US', title: 'English'},
        ])
      }
      if (query.includes('translation.metadata')) {
        return Promise.resolve(
          options.translations === undefined ? null : {translations: options.translations},
        )
      }
      return Promise.resolve(sourceDoc)
    }),
    getDocument: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
    transaction: vi.fn().mockReturnValue(tx),
    withConfig: vi.fn(),
  }
  contentClient.withConfig.mockReturnValue(contentClient)

  const workflowClient = {
    action: vi.fn(),
    create: vi.fn(),
    fetch: vi.fn().mockImplementation((query: string) => {
      if (query.includes('perspective')) return Promise.resolve(options.perspective ?? null)
      return Promise.resolve(options.settledEffectKeys ?? [])
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
    setProgress: vi.fn().mockResolvedValue(undefined),
  }

  return {contentClient, ctx, patchCalls, sourceDoc, translate, tx, workflowClient}
}

function builtParams() {
  const result = vi.mocked(buildTranslateParams).mock.results[0]
  if (!result || result.type !== 'return') throw new Error('buildTranslateParams was not called')
  return result.value
}

beforeEach(() => {
  vi.mocked(buildTranslateParams).mockClear()
})

describe('translate-locale', () => {
  it('calls buildTranslateParams with the assembled context for a new translation', async () => {
    const {ctx} = harness()

    await translateLocale({source: SOURCE, locale: 'de-DE', release: null, revisionNote: null}, ctx)

    expect(buildTranslateParams).toHaveBeenCalledTimes(1)
    expect(buildTranslateParams).toHaveBeenCalledWith({
      schemaId: '_.schemas.default',
      documentId: 'article-1',
      glossaries: [GLOSSARY],
      targetLocale: {code: 'de-DE', title: 'German'},
      sourceLocale: {code: 'en-US', title: 'English'},
      styleGuide: STYLE_GUIDE,
      languageFieldPath: 'language',
      operation: 'create',
    })
  })

  it('edits the existing translation in place when the join document names one', async () => {
    const {ctx} = harness({translations: [{language: 'de-DE', ref: 'article-1-de'}]})

    await translateLocale({source: SOURCE, locale: 'de-DE', release: null, revisionNote: null}, ctx)

    expect(buildTranslateParams).toHaveBeenCalledWith(
      expect.objectContaining({operation: 'edit', targetDocumentId: 'article-1-de'}),
    )
  })

  it('passes buildTranslateParams field by field to the agent, with noWrite', async () => {
    const {ctx, translate} = harness()

    await translateLocale({source: SOURCE, locale: 'de-DE', release: null, revisionNote: null}, ctx)

    const built = builtParams()
    expect(translate).toHaveBeenCalledWith({
      schemaId: built.schemaId,
      documentId: built.documentId,
      noWrite: true,
      fromLanguage: built.fromLanguage,
      toLanguage: built.toLanguage,
      styleGuide: built.styleGuide,
      protectedPhrases: built.protectedPhrases,
      languageFieldPath: built.languageFieldPath,
      targetDocument: built.targetDocument,
    })
  })

  it('appends a reviewer revision note to the assembled style guide', async () => {
    const {ctx, translate} = harness()

    await translateLocale(
      {source: SOURCE, locale: 'de-DE', release: null, revisionNote: 'Keep the product name'},
      ctx,
    )

    const built = builtParams()
    expect(translate).toHaveBeenCalledWith(
      expect.objectContaining({
        styleGuide: `${built.styleGuide}\n\n## Revision request\n\nKeep the product name`,
      }),
    )
  })

  it('writes a draft and returns the target ref when no release is bound', async () => {
    const {contentClient, ctx} = harness()

    const result = await translateLocale(
      {source: SOURCE, locale: 'de-DE', release: null, revisionNote: null},
      ctx,
    )

    expect(contentClient.createOrReplace).toHaveBeenCalledWith(
      expect.objectContaining({_id: 'drafts.article-1-de', _type: 'article', language: 'de-DE'}),
      {tag: 'write-draft'},
    )
    expect(contentClient.action).not.toHaveBeenCalled()
    expect(result).toEqual({
      ops: [
        {
          type: 'field.set',
          target: {scope: 'workflow', field: 'target'},
          value: {
            type: 'literal',
            value: {id: 'dataset:proj1:production:article-1-de', type: 'article'},
          },
        },
        // The revision the draft was written at, taken from the write itself:
        // the reviewer is the next writer, so this is the last moment the
        // machine output is unambiguously the machine's.
        {
          type: 'field.set',
          target: {scope: 'workflow', field: 'machineRev'},
          value: {type: 'literal', value: DRAFT_REV},
        },
      ],
    })
  })

  it('records the revision the version write committed', async () => {
    const {ctx} = harness()

    const result = await translateLocale(
      {source: SOURCE, locale: 'de-DE', release: RELEASE, revisionNote: null},
      ctx,
    )

    // A version action answers with its transaction id, which is the revision
    // that transaction stamped on the document it wrote.
    expect(result?.ops).toContainEqual({
      type: 'field.set',
      target: {scope: 'workflow', field: 'machineRev'},
      value: {type: 'literal', value: VERSION_REV},
    })
  })

  it('post-processes the translation before writing it', async () => {
    const {contentClient, ctx} = harness()

    await translateLocale({source: SOURCE, locale: 'de-DE', release: null, revisionNote: null}, ctx)

    const [document] = contentClient.createOrReplace.mock.calls[0] ?? []
    expect(document).toMatchObject({slug: {current: 'der-acme-widget-start'}})
    expect(document).not.toHaveProperty('audioSummary')
  })

  it('creates a version in the release when one is bound', async () => {
    const {contentClient, ctx} = harness()

    await translateLocale(
      {source: SOURCE, locale: 'de-DE', release: RELEASE, revisionNote: null},
      ctx,
    )

    expect(contentClient.createOrReplace).not.toHaveBeenCalled()
    expect(contentClient.action).toHaveBeenCalledWith(
      {
        actionType: 'sanity.action.document.version.create',
        document: expect.objectContaining({_id: 'versions.summer.article-1-de'}),
        publishedId: 'article-1-de',
      },
      {tag: 'write-to-release'},
    )
  })

  it('tolerates a version that a previous delivery already created', async () => {
    const {contentClient, ctx} = harness()
    contentClient.action.mockRejectedValue(Object.assign(new Error('conflict'), {statusCode: 409}))

    const result = await translateLocale(
      {source: SOURCE, locale: 'de-DE', release: RELEASE, revisionNote: null},
      ctx,
    )

    // The effect still completes, but this delivery wrote nothing, so it has no
    // revision of its own to record.
    expect(result?.ops).toEqual([
      {
        type: 'field.set',
        target: {scope: 'workflow', field: 'target'},
        value: {
          type: 'literal',
          value: {id: 'dataset:proj1:production:article-1-de', type: 'article'},
        },
      },
    ])
  })

  it('rethrows a version write that failed for any other reason', async () => {
    const {contentClient, ctx} = harness()
    contentClient.action.mockRejectedValue(Object.assign(new Error('boom'), {statusCode: 500}))

    await expect(
      translateLocale({source: SOURCE, locale: 'de-DE', release: RELEASE, revisionNote: null}, ctx),
    ).rejects.toThrow('boom')
  })

  it('registers a brand-new locale on the translation.metadata join document', async () => {
    const {ctx, patchCalls, tx} = harness()

    await translateLocale({source: SOURCE, locale: 'de-DE', release: null, revisionNote: null}, ctx)

    const sourceRef = {
      _type: 'internationalizedArrayReferenceValue',
      language: 'en-US',
      value: {
        _ref: 'article-1',
        _type: 'reference',
        _weak: true,
        _strengthenOnPublish: {type: 'article'},
      },
    }

    expect(tx.createIfNotExists).toHaveBeenCalledWith({
      _id: 'translation.metadata.article-1',
      _type: 'translation.metadata',
      schemaTypes: ['article'],
      translations: [sourceRef],
    })
    expect(tx.patch).toHaveBeenCalledWith('translation.metadata.article-1', expect.any(Function))
    expect(tx.commit).toHaveBeenCalledWith({autoGenerateArrayKeys: true, tag: 'link-locale'})
    expect(patchCalls).toEqual([
      ['setIfMissing', {translations: [sourceRef]}],
      ['unset', ['translations[language=="de-DE"]']],
      [
        'append',
        {
          path: 'translations',
          items: [
            {
              _type: 'internationalizedArrayReferenceValue',
              language: 'de-DE',
              value: {
                _ref: 'article-1-de',
                _type: 'reference',
                _weak: true,
                _strengthenOnPublish: {type: 'article'},
              },
            },
          ],
        },
      ],
    ])
  })

  it('leaves the join document alone when the locale already has a row', async () => {
    const {ctx, tx} = harness({translations: [{language: 'de-DE', ref: 'article-1-de'}]})

    await translateLocale({source: SOURCE, locale: 'de-DE', release: null, revisionNote: null}, ctx)

    expect(tx.commit).not.toHaveBeenCalled()
  })

  it('writes the join document exactly once across a redelivery', async () => {
    const first = harness()
    await translateLocale(
      {source: SOURCE, locale: 'de-DE', release: null, revisionNote: null},
      first.ctx,
    )

    // The redelivery arrives after the first completion settled the ledger.
    const second = harness({settledEffectKeys: ['effect-1']})
    await translateLocale(
      {source: SOURCE, locale: 'de-DE', release: null, revisionNote: null},
      second.ctx,
    )

    expect(first.tx.commit).toHaveBeenCalledTimes(1)
    expect(second.tx.commit).not.toHaveBeenCalled()
  })

  it('short-circuits a redelivery whose effect key already settled', async () => {
    const {ctx, translate} = harness({settledEffectKeys: ['effect-1']})

    const result = await translateLocale(
      {source: SOURCE, locale: 'de-DE', release: null, revisionNote: null},
      ctx,
    )

    expect(result).toBeUndefined()
    expect(translate).not.toHaveBeenCalled()
    expect(buildTranslateParams).not.toHaveBeenCalled()
  })

  it('reports progress from start to finish', async () => {
    const {ctx} = harness()

    await translateLocale({source: SOURCE, locale: 'de-DE', release: null, revisionNote: null}, ctx)

    expect(ctx.setProgress.mock.calls.map(([, value]) => value)).toEqual([10, 25, 70, 100])
  })
})

describe('translate-locale, field tier', () => {
  const PERSON_SOURCE = 'dataset:proj1:production:person-1'

  function bioEntry(language: string, value: string, key: string) {
    return {_key: key, _type: 'internationalizedArrayTextValue', language, value}
  }

  const PERSON_DOC = {
    _id: 'person-1',
    _originalId: 'person-1',
    _rev: 'rev-2',
    _type: 'person',
    name: 'Ada Lovelace',
    bio: [bioEntry('en-US', 'Ada writes about Acme.', 'bio-en')],
    seo: {
      _type: 'seo',
      metaTitle: [
        {
          _key: 'mt-en',
          _type: 'internationalizedArrayStringValue',
          language: 'en-US',
          value: 'Ada',
        },
      ],
      metaDescription: [bioEntry('en-US', 'About Ada.', 'md-en')],
    },
  }

  /** What `noWrite` hands back: the source entries, translated where they lie. */
  const PERSON_TRANSLATED = {
    ...PERSON_DOC,
    bio: [bioEntry('en-US', 'Ada schreibt über Acme.', 'bio-en')],
    seo: {
      _type: 'seo',
      metaTitle: [
        {
          _key: 'mt-en',
          _type: 'internationalizedArrayStringValue',
          language: 'en-US',
          value: 'Ada',
        },
      ],
      metaDescription: [bioEntry('en-US', 'Über Ada.', 'md-en')],
    },
  }

  function personHarness(overrides: Parameters<typeof harness>[0] = {}) {
    return harness({
      sourceDoc: PERSON_DOC,
      perspective: 'published',
      translated: PERSON_TRANSLATED,
      ...overrides,
    })
  }

  it('translates every internationalized field in one call, in place', async () => {
    const {ctx, translate} = personHarness()

    await translateLocale(
      {source: PERSON_SOURCE, locale: 'de-DE', release: null, revisionNote: null},
      ctx,
    )

    expect(translate).toHaveBeenCalledTimes(1)
    const [request] = translate.mock.calls[0]
    // The source entries are the targets: the agent translates them where they
    // lie and `noWrite` keeps the document untouched.
    expect(request.target).toEqual([
      {path: ['bio', {_key: 'bio-en'}, 'value']},
      {path: ['seo', 'metaTitle', {_key: 'mt-en'}, 'value']},
      {path: ['seo', 'metaDescription', {_key: 'md-en'}, 'value']},
    ])
    expect(request.noWrite).toBe(true)
    // Source and target are the same document, and there is no language field
    // to name — either would be rejected by the API.
    expect(request).not.toHaveProperty('targetDocument')
    expect(request).not.toHaveProperty('languageFieldPath')
  })

  it('assembles its context through the same seam as the document tier', async () => {
    const {ctx} = personHarness()

    await translateLocale(
      {source: PERSON_SOURCE, locale: 'de-DE', release: null, revisionNote: null},
      ctx,
    )

    expect(buildTranslateParams).toHaveBeenCalledWith({
      schemaId: '_.schemas.default',
      documentId: 'person-1',
      glossaries: [GLOSSARY],
      targetLocale: {code: 'de-DE', title: 'German'},
      sourceLocale: {code: 'en-US', title: 'English'},
      styleGuide: STYLE_GUIDE,
      inPlace: true,
    })
    const built = builtParams()
    expect(built.targetDocument).toBeUndefined()
    expect(built.protectedPhrases).toEqual([])
    expect(built.styleGuide).toContain('Acme')
  })

  it('patches one keyed entry per field into the subject’s own draft', async () => {
    const {contentClient, ctx, patchCalls, tx} = personHarness()

    await translateLocale(
      {source: PERSON_SOURCE, locale: 'de-DE', release: null, revisionNote: null},
      ctx,
    )

    // The draft has to exist before it can be patched, and the read artifacts
    // of a perspective fetch are not content.
    expect(contentClient.createIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({_id: 'drafts.person-1', _type: 'person', name: 'Ada Lovelace'}),
      {tag: 'write-draft'},
    )
    const [created] = contentClient.createIfNotExists.mock.calls[0]
    expect(created).not.toHaveProperty('_rev')
    expect(created).not.toHaveProperty('_originalId')

    expect(tx.patch.mock.calls.map((call) => call[0])).toEqual([
      'drafts.person-1',
      'drafts.person-1',
      'drafts.person-1',
      'drafts.person-1',
    ])
    expect(patchCalls).toEqual([
      // `seo` first: a patch does not create a missing parent object.
      ['setIfMissing', {seo: {_type: 'seo'}}],

      ['setIfMissing', {bio: []}],
      ['unset', ['bio[language=="de-DE"]']],
      [
        'append',
        {
          path: 'bio',
          items: [
            {
              _type: 'internationalizedArrayTextValue',
              language: 'de-DE',
              value: 'Ada schreibt über Acme.',
            },
          ],
        },
      ],

      ['setIfMissing', {'seo.metaTitle': []}],
      ['unset', ['seo.metaTitle[language=="de-DE"]']],
      [
        'append',
        {
          path: 'seo.metaTitle',
          items: [{_type: 'internationalizedArrayStringValue', language: 'de-DE', value: 'Ada'}],
        },
      ],

      ['setIfMissing', {'seo.metaDescription': []}],
      ['unset', ['seo.metaDescription[language=="de-DE"]']],
      [
        'append',
        {
          path: 'seo.metaDescription',
          items: [
            {_type: 'internationalizedArrayTextValue', language: 'de-DE', value: 'Über Ada.'},
          ],
        },
      ],
    ])
    expect(tx.commit).toHaveBeenCalledWith({
      autoGenerateArrayKeys: true,
      tag: 'write-locale-entries',
    })
  })

  it('declares the subject itself as the translated document', async () => {
    const {ctx} = personHarness()

    const result = await translateLocale(
      {source: PERSON_SOURCE, locale: 'de-DE', release: null, revisionNote: null},
      ctx,
    )

    expect(result).toEqual({
      ops: [
        {
          type: 'field.set',
          target: {scope: 'workflow', field: 'target'},
          value: {
            type: 'literal',
            value: {id: 'dataset:proj1:production:person-1', type: 'person'},
          },
        },
        {
          type: 'field.set',
          target: {scope: 'workflow', field: 'machineRev'},
          value: {type: 'literal', value: ENTRIES_REV},
        },
      ],
    })
  })

  it('reads back the revision its locale entries landed at', async () => {
    const {contentClient, ctx} = personHarness()

    await translateLocale(
      {source: PERSON_SOURCE, locale: 'de-DE', release: RELEASE, revisionNote: null},
      ctx,
    )

    // The commit reports its transaction, not the document, so the revision
    // costs a read — of the literal version id, hence the raw perspective.
    expect(contentClient.fetch).toHaveBeenCalledWith(
      '*[_id == $targetId][0]._rev',
      {targetId: 'versions.summer.person-1'},
      {perspective: 'raw', tag: 'read-machine-rev'},
    )
  })

  it('never touches the translation.metadata join document', async () => {
    const {tx, ctx} = personHarness()

    await translateLocale(
      {source: PERSON_SOURCE, locale: 'de-DE', release: null, revisionNote: null},
      ctx,
    )

    // Coverage for the field tier is derived from the arrays themselves.
    expect(tx.createIfNotExists).not.toHaveBeenCalled()
  })

  it('writes into the release version when a campaign bound one', async () => {
    const {contentClient, ctx, tx} = personHarness()

    await translateLocale(
      {source: PERSON_SOURCE, locale: 'de-DE', release: RELEASE, revisionNote: null},
      ctx,
    )

    expect(contentClient.createIfNotExists).not.toHaveBeenCalled()
    expect(contentClient.action).toHaveBeenCalledWith(
      {
        actionType: 'sanity.action.document.version.create',
        document: expect.objectContaining({_id: 'versions.summer.person-1', _type: 'person'}),
        publishedId: 'person-1',
      },
      {tag: 'write-to-release'},
    )
    expect(tx.patch.mock.calls.map((call) => call[0])).toEqual(
      Array<string>(4).fill('versions.summer.person-1'),
    )
  })

  it('tolerates a sibling locale that created the version first', async () => {
    const {contentClient, ctx, tx} = personHarness()
    contentClient.action.mockRejectedValue(Object.assign(new Error('conflict'), {statusCode: 409}))

    await translateLocale(
      {source: PERSON_SOURCE, locale: 'de-DE', release: RELEASE, revisionNote: null},
      ctx,
    )

    expect(tx.commit).toHaveBeenCalledTimes(1)
  })

  it('replaces its own entry rather than adding a second on redelivery', async () => {
    // The entry this run already wrote is present when it comes round again.
    const withGerman = {
      ...PERSON_DOC,
      bio: [...PERSON_DOC.bio, bioEntry('de-DE', 'Alt', 'bio-de')],
    }
    const {ctx, patchCalls} = personHarness({sourceDoc: withGerman})

    await translateLocale(
      {source: PERSON_SOURCE, locale: 'de-DE', release: null, revisionNote: null},
      ctx,
    )

    // Unset by language, not by key: the replacement lands whatever key the
    // previous delivery minted.
    expect(patchCalls).toContainEqual(['unset', ['bio[language=="de-DE"]']])
    expect(patchCalls.filter(([op]) => op === 'append')).toHaveLength(3)
  })

  it('skips a field with no source content rather than failing the locale', async () => {
    const {ctx, patchCalls, translate} = personHarness({
      sourceDoc: {...PERSON_DOC, seo: {_type: 'seo', metaTitle: [], metaDescription: []}},
    })

    await translateLocale(
      {source: PERSON_SOURCE, locale: 'de-DE', release: null, revisionNote: null},
      ctx,
    )

    expect(translate.mock.calls[0][0].target).toEqual([{path: ['bio', {_key: 'bio-en'}, 'value']}])
    expect(patchCalls.map(([op]) => op)).toEqual(['setIfMissing', 'unset', 'append'])
  })

  it('fails the locale when the source carries nothing to translate', async () => {
    const {ctx} = personHarness({sourceDoc: {_id: 'person-1', _type: 'person', name: 'Ada'}})

    await expect(
      translateLocale(
        {source: PERSON_SOURCE, locale: 'de-DE', release: null, revisionNote: null},
        ctx,
      ),
    ).rejects.toThrow('no en-US content')
  })

  it('fails the locale when the agent returns no value for a field', async () => {
    const {ctx} = personHarness({
      translated: {...PERSON_TRANSLATED, bio: [bioEntry('en-US', '', 'bio-en')]},
    })

    await expect(
      translateLocale(
        {source: PERSON_SOURCE, locale: 'de-DE', release: null, revisionNote: null},
        ctx,
      ),
    ).rejects.toThrow('Translation returned no de-DE value for "bio"')
  })

  it('reads the subject under the perspective the run was started with', async () => {
    const {contentClient, ctx} = personHarness()

    await translateLocale(
      {source: PERSON_SOURCE, locale: 'de-DE', release: null, revisionNote: null},
      ctx,
    )

    expect(contentClient.fetch).toHaveBeenCalledWith(
      '*[_id == $id][0]',
      {id: 'person-1'},
      {perspective: 'published', tag: 'get-source-doc'},
    )
  })

  it('points the agent at the layer the entry keys came from', async () => {
    // A campaign-spawned run keeps the engine's drafts default, so the
    // perspective read resolves the draft — and its keys only exist there.
    const {ctx} = personHarness({
      perspective: null,
      sourceDoc: {...PERSON_DOC, _originalId: 'drafts.person-1'},
    })

    await translateLocale(
      {source: PERSON_SOURCE, locale: 'de-DE', release: RELEASE, revisionNote: null},
      ctx,
    )

    expect(buildTranslateParams).toHaveBeenCalledWith(
      expect.objectContaining({documentId: 'drafts.person-1'}),
    )
  })
})
