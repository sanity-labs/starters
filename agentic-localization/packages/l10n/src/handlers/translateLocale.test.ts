import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {Glossary, StyleGuide} from '../promptAssembly'

vi.mock('../promptAssembly', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../promptAssembly')>()
  return {...actual, buildTranslateParams: vi.fn(actual.buildTranslateParams)}
})

import {buildTranslateParams} from '../promptAssembly'
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

function harness(options: {settledEffectKeys?: string[]; translations?: unknown[] | null} = {}) {
  const translate = vi.fn().mockResolvedValue(TRANSLATED)
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
    action: vi.fn().mockResolvedValue({}),
    agent: {action: {prompt: vi.fn(), translate}},
    create: vi.fn(),
    createIfNotExists: vi.fn(),
    createOrReplace: vi.fn().mockResolvedValue({}),
    fetch: vi.fn().mockImplementation((query: string) => {
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
      if (query.includes('$draftId')) return Promise.resolve(SOURCE_DOC)
      return Promise.resolve(SOURCE_DOC)
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
    fetch: vi.fn().mockResolvedValue(options.settledEffectKeys ?? []),
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

  return {contentClient, ctx, patchCalls, translate, tx, workflowClient}
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
      ],
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

    await expect(
      translateLocale({source: SOURCE, locale: 'de-DE', release: RELEASE, revisionNote: null}, ctx),
    ).resolves.toBeDefined()
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
