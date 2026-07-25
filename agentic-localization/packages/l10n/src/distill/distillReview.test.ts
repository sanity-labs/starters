/**
 * The pipeline, driven against stand-in clients.
 *
 * What is faked is exactly the network: the History API, the perspective reads,
 * the mutation endpoints and the one Agent Action. Everything the loop decides —
 * claim ordering, the tier each locale is read through, the noise gate, what
 * reaches the model and what the model is allowed to be believed about — is the
 * real code.
 */

import {describe, expect, it} from 'vitest'

import type {ResolvedFieldEntry, WorkflowInstance} from '@sanity/workflow-engine'
import type {
  DistillClient,
  DistillEngine,
  DistillPatchOperations,
  DistillTransaction,
} from './gather'

import {claimId, distillReview} from './distillReview'

const NOW = new Date('2026-07-25T12:00:00.000Z')
const PARENT = 'wf-instance-parent'
const CONTENT_DATASET = 'production'

const SOURCE_TEXT = 'The dataset is stored in the Content Lake and queried with GROQ.'

// --- Fixtures ---------------------------------------------------------------

function block(text: string) {
  return {
    _key: 'b1',
    _type: 'block',
    style: 'normal',
    children: [{_key: 's1', _type: 'span', marks: [], text}],
  }
}

function entry(itemType: string, language: string, value: string, key = `${language}-1`) {
  return {_key: key, _type: itemType, language, value}
}

function docRef(name: string, documentId: string, type: string): ResolvedFieldEntry {
  return {
    _key: name,
    _type: 'doc.ref',
    name,
    value: {id: `dataset:p1:${CONTENT_DATASET}:${documentId}`, type},
  } as unknown as ResolvedFieldEntry
}

function stringField(name: string, value: string): ResolvedFieldEntry {
  return {_key: name, _type: 'string', name, value} as unknown as ResolvedFieldEntry
}

function releaseField(releaseName: string): ResolvedFieldEntry {
  return {
    _key: 'release',
    _type: 'release.ref',
    name: 'release',
    value: {
      id: `dataset:p1:${CONTENT_DATASET}:_.releases.${releaseName}`,
      type: 'system.release',
      releaseName,
    },
  } as unknown as ResolvedFieldEntry
}

function localesField(locales: string[]): ResolvedFieldEntry {
  return {
    _key: 'targetLocales',
    _type: 'array',
    name: 'targetLocales',
    value: locales.map((locale) => ({_key: locale, locale, reason: 'body changed'})),
  } as unknown as ResolvedFieldEntry
}

function subworkflowRow(locale: string) {
  return {
    _key: locale,
    activity: 'translate',
    action: 'fan-out',
    definition: 'localize-locale',
    stageEntry: 'stage-1',
    cohortStage: 'translating',
    rowKey: locale,
    ref: {id: `dataset:p1:workflows:child-${locale}`, type: 'workflow.instance'},
    spawnedAt: '2026-07-25T10:00:00.000Z',
    resolved: {at: '2026-07-25T10:05:00.000Z', stage: 'translated'},
  }
}

/** A parent instance, only as complete as the readers need. */
function parentInstance(args: {
  fields: ResolvedFieldEntry[]
  locales: string[]
  perspective?: string
}): WorkflowInstance {
  return {
    _id: PARENT,
    _type: 'sanity.workflow.instance',
    currentStage: 'approved',
    fields: args.fields,
    subworkflows: args.locales.map(subworkflowRow),
    ...(args.perspective ? {perspective: args.perspective} : {}),
  } as unknown as WorkflowInstance
}

function childInstance(args: {
  locale: string
  targetId: string
  targetType: string
  /** Absent models the redelivered effect that recorded no revision of its own. */
  machineRev?: string
  ranAt?: string
}): WorkflowInstance {
  return {
    _id: `child-${args.locale}`,
    _type: 'sanity.workflow.instance',
    currentStage: 'translated',
    fields: [
      stringField('locale', args.locale),
      ...(args.machineRev ? [stringField('machineRev', args.machineRev)] : []),
      docRef('target', args.targetId, args.targetType),
    ],
    effectHistory: [
      {
        _key: 'e1',
        name: 'translate-locale',
        status: 'done',
        ranAt: args.ranAt ?? '2026-07-25T11:00:00.000Z',
        params: {},
        origin: {kind: 'trigger'},
      },
    ],
  } as unknown as WorkflowInstance
}

// --- The stand-in clients ---------------------------------------------------

interface HarnessOptions {
  /** Literal document ids to bodies — the raw layer. */
  documents?: Record<string, Record<string, unknown>>
  /** `<literalId>@<revision>` to bodies — what the History API answers. */
  revisions?: Record<string, Record<string, unknown>>
  locales?: string[]
  /** What the one Agent Action answers. */
  promptResponse?: string
  /** Ids that already exist, so `create` conflicts. */
  claimed?: string[]
  /** Blow up the first History read, to prove the failure is recorded. */
  breakHistory?: boolean
}

function harness(options: HarnessOptions = {}) {
  const documents = {...options.documents}
  const revisions = {...options.revisions}
  const created = new Set(options.claimed ?? [])
  const log: string[] = []
  const writes: Record<string, unknown>[] = []
  const patches: {id: string; operations: DistillPatchOperations}[] = []
  const prompts: string[] = []
  const deletes: {query: string; params?: Record<string, unknown>}[] = []
  const historyUrls: string[] = []

  const transaction = (): DistillTransaction => {
    const tx: DistillTransaction = {
      createIfNotExists: (document) => {
        writes.push(document)
        return tx
      },
      patch: (id, operations) => {
        patches.push({id, operations})
        return tx
      },
      commit: async () => {
        log.push('commit')
        return {}
      },
    }
    return tx
  }

  /** Perspective resolution, to the extent the loop depends on it. */
  function resolve(id: string, perspective: string | string[] | undefined) {
    if (perspective === 'raw') return documents[id] ?? null
    if (perspective === 'published') return documents[id] ?? null
    const draft = documents[`drafts.${id}`]
    if (draft) return {...draft, _originalId: `drafts.${id}`, _id: id}
    return documents[id] ?? null
  }

  const client: DistillClient = {
    fetch: async <T>(
      query: string,
      params?: Record<string, unknown>,
      fetchOptions?: {perspective?: string | string[]; tag?: string},
    ): Promise<T> => {
      log.push(`fetch:${fetchOptions?.tag ?? 'untagged'}`)
      if (query.includes('l10n.locale')) {
        return (options.locales ?? ['en-US', 'de-DE', 'fr-FR']) as T
      }
      const id = typeof params?.id === 'string' ? params.id : ''
      return resolve(id, fetchOptions?.perspective) as T
    },

    // Keyed `<literalId>@<revision-or-time>`, so a `?time=` read is looked up the
    // same way a `?revision=` one is.
    request: async <T>(requestOptions: {url: string}): Promise<T> => {
      log.push('request:history')
      historyUrls.push(requestOptions.url)
      if (options.breakHistory) throw new Error('history exploded')
      const match = requestOptions.url.match(/documents\/(.+)\?(?:revision|time)=(.+)$/)
      const key = match ? `${match[1]}@${decodeURIComponent(match[2])}` : ''
      const document = revisions[key]
      if (!document) {
        const notFound: Error & {statusCode?: number} = new Error(`no revision ${key}`)
        notFound.statusCode = 404
        throw notFound
      }
      return {documents: [document]} as T
    },

    create: async (document) => {
      log.push(`create:${document._id}`)
      if (created.has(document._id)) {
        const conflict: Error & {statusCode?: number} = new Error('already exists')
        conflict.statusCode = 409
        throw conflict
      }
      created.add(document._id)
      writes.push(document)
      return document
    },

    delete: async (selection) => {
      log.push('delete:sweep')
      deletes.push(selection)
      return {}
    },

    transaction,

    agent: {
      action: {
        prompt: async ({instruction}) => {
          log.push('prompt')
          prompts.push(instruction)
          return options.promptResponse ?? JSON.stringify({proposals: []})
        },
      },
    },
  }

  return {client, deletes, historyUrls, log, patches, prompts, writes}
}

function engineFor(instance: WorkflowInstance, children: WorkflowInstance[]): DistillEngine {
  return {
    getInstance: async () => instance,
    children: async () => children,
  } as unknown as DistillEngine
}

function run(client: DistillClient, engine: DistillEngine) {
  return distillReview({
    client,
    dataset: CONTENT_DATASET,
    engine,
    instanceId: PARENT,
    now: () => NOW,
  })
}

// --- Scenarios --------------------------------------------------------------

const RAN_AT = '2026-07-25T11:00:00.000Z'

/** The document tier: one sibling document per locale, written as a draft. */
function documentTier(
  options: {
    human: {title: string; body: string}
    /** `null` models a child that recorded no revision of its own. */
    machineRev?: null | string
  } & HarnessOptions,
) {
  const instance = parentInstance({
    fields: [docRef('subject', 'article-1', 'article'), localesField(['de-DE'])],
    locales: ['de-DE'],
  })
  const children = [
    childInstance({
      locale: 'de-DE',
      targetId: 'article-1-de',
      targetType: 'article',
      ...(options.machineRev === null ? {} : {machineRev: options.machineRev ?? 'rev-m-de'}),
      ranAt: RAN_AT,
    }),
  ]

  const test = harness({
    ...options,
    documents: {
      'drafts.article-1': {
        _id: 'drafts.article-1',
        _type: 'article',
        title: 'The dataset guide',
        body: [block(SOURCE_TEXT)],
      },
      'drafts.article-1-de': {
        _id: 'drafts.article-1-de',
        _type: 'article',
        language: 'de-DE',
        title: options.human.title,
        body: [block(options.human.body)],
      },
      ...options.documents,
    },
    revisions: {
      'drafts.article-1-de@rev-m-de': {
        _id: 'drafts.article-1-de',
        _type: 'article',
        language: 'de-DE',
        title: 'Der Datensatz Leitfaden',
        body: [block('Der Datensatz wird im Content Lake gespeichert.')],
      },
      ...options.revisions,
    },
  })

  return {...test, engine: engineFor(instance, children)}
}

/** The field tier: every locale lives in the subject's own arrays. */
function fieldTier(options: {bio: Record<string, string>} & HarnessOptions) {
  const instance = parentInstance({
    fields: [docRef('subject', 'person-ada', 'person'), localesField(['de-DE'])],
    locales: ['de-DE'],
    perspective: 'published',
  })
  const children = [
    childInstance({
      locale: 'de-DE',
      targetId: 'person-ada',
      targetType: 'person',
      machineRev: 'rev-m-de',
    }),
  ]

  const bioEntries = (values: Record<string, string>) =>
    Object.entries(values).map(([language, value]) =>
      entry('internationalizedArrayTextValue', language, value),
    )

  const test = harness({
    ...options,
    documents: {
      // The published layer the run reads its source from.
      'person-ada': {
        _id: 'person-ada',
        _type: 'person',
        name: 'Ada Lovelace',
        bio: bioEntries({'en-US': SOURCE_TEXT}),
      },
      // The draft the locale children patched, then a human edited.
      'drafts.person-ada': {
        _id: 'drafts.person-ada',
        _type: 'person',
        name: 'Ada Lovelace',
        bio: bioEntries({'en-US': SOURCE_TEXT, ...options.bio}),
      },
    },
    revisions: {
      'drafts.person-ada@rev-m-de': {
        _id: 'drafts.person-ada',
        _type: 'person',
        name: 'Ada Lovelace',
        bio: bioEntries({
          'en-US': SOURCE_TEXT,
          'de-DE': 'Der Datensatz wird im Content Lake gespeichert und mit GROQ abgefragt.',
        }),
      },
    },
  })

  return {...test, engine: engineFor(instance, children)}
}

/** A campaign child: the target is a release version, read raw. */
function releaseTier(options: {human: string} & HarnessOptions) {
  const instance = parentInstance({
    fields: [
      docRef('subject', 'article-1', 'article'),
      releaseField('summer'),
      localesField(['de-DE']),
    ],
    locales: ['de-DE'],
  })
  const children = [
    childInstance({
      locale: 'de-DE',
      targetId: 'article-1-de',
      targetType: 'article',
      machineRev: 'rev-m-de',
    }),
  ]

  const test = harness({
    ...options,
    documents: {
      'drafts.article-1': {
        _id: 'drafts.article-1',
        _type: 'article',
        title: 'The dataset guide',
        body: [block(SOURCE_TEXT)],
      },
      // Deliberately also present as a draft: reading the wrong layer would
      // silently compare the campaign's machine output against another run's.
      'drafts.article-1-de': {
        _id: 'drafts.article-1-de',
        _type: 'article',
        title: 'Ein ganz anderer Entwurf mit anderen Worten darin',
      },
      'versions.summer.article-1-de': {
        _id: 'versions.summer.article-1-de',
        _type: 'article',
        language: 'de-DE',
        title: options.human,
      },
    },
    revisions: {
      'versions.summer.article-1-de@rev-m-de': {
        _id: 'versions.summer.article-1-de',
        _type: 'article',
        language: 'de-DE',
        title: 'Der Datensatz Leitfaden',
      },
    },
  })

  return {...test, engine: engineFor(instance, children)}
}

const TERM_PROPOSAL = JSON.stringify({
  proposals: [
    {
      kind: 'glossary-term',
      locale: 'de-DE',
      term: 'dataset',
      translation: 'Dataset',
      fieldPath: 'body',
      rationale: 'The team ships the English product term.',
    },
  ],
})

// --- Claiming ---------------------------------------------------------------

describe('the claim', () => {
  it('is taken before anything that can fail', async () => {
    const {client, engine, log} = documentTier({
      human: {title: 'Das Dataset Handbuch', body: 'Das Dataset wird im Content Lake abgelegt.'},
    })
    await run(client, engine)

    // The sweep is a delete of other runs' litter, so it may precede the claim;
    // nothing that READS this run may.
    const claim = log.indexOf(`create:${claimId(PARENT)}`)
    const firstRead = log.findIndex(
      (call) => call.startsWith('fetch:') || call === 'request:history',
    )
    expect(claim).toBeGreaterThanOrEqual(0)
    expect(claim).toBeLessThan(firstRead)
  })

  it('sweeps its own litter by prefix and age, not by type scan', async () => {
    const {client, deletes, engine} = documentTier({
      human: {
        title: 'Der Datensatz Leitfaden',
        body: 'Der Datensatz wird im Content Lake gespeichert.',
      },
    })
    await run(client, engine)

    expect(deletes).toHaveLength(1)
    expect(deletes[0].query).toContain('string::startsWith(_id, $prefix)')
    expect(deletes[0].params).toMatchObject({prefix: 'l10n.distillation.'})
    expect(String(deletes[0].params?.cutoff) < NOW.toISOString()).toBe(true)
  })

  it('short-circuits a redelivered event without reading or spending', async () => {
    const {client, engine, log, prompts} = documentTier({
      claimed: [claimId(PARENT)],
      human: {title: 'Das Dataset Handbuch', body: 'Das Dataset wird im Content Lake abgelegt.'},
    })

    const result = await run(client, engine)

    expect(result.outcome).toBe('already-claimed')
    expect(result.aiSpent).toBe(0)
    expect(result.proposals).toBe(0)
    expect(prompts).toEqual([])
    expect(log.filter((call) => call.startsWith('fetch:'))).toEqual([])
  })

  it('is derived from the instance id, so the same run always claims the same document', () => {
    expect(claimId(PARENT)).toBe(claimId(PARENT))
    expect(claimId(PARENT)).toMatch(/^l10n\.distillation\.[0-9a-f]{16}$/)
    expect(claimId('wf-instance-other')).not.toBe(claimId(PARENT))
  })

  it('records what the run turned out to be', async () => {
    const {client, engine, patches} = documentTier({
      promptResponse: TERM_PROPOSAL,
      human: {title: 'Das Dataset Handbuch', body: 'Das Dataset wird im Content Lake abgelegt.'},
    })
    await run(client, engine)

    const settle = patches.find((patch) => patch.id === claimId(PARENT))
    expect(settle?.operations.set).toMatchObject({
      status: 'done',
      completedAt: NOW.toISOString(),
      outcome: 'distilled',
      aiSpent: 1,
      proposals: 1,
      locales: ['de-DE'],
      subject: {_type: 'reference', _ref: 'article-1', _weak: true},
    })
    // Nothing was skipped, so there is no reason to record.
    expect(settle?.operations.set?.skipReason).toBeUndefined()
  })

  it('records why a run that spent nothing spent nothing', async () => {
    const {client, engine, patches} = documentTier({
      human: {
        title: 'Der Datensatz Leitfaden',
        body: 'Der Datensatz wird im Content Lake gespeichert.',
      },
    })
    await run(client, engine)

    const settle = patches.find((patch) => patch.id === claimId(PARENT))
    expect(settle?.operations.set).toMatchObject({
      status: 'done',
      outcome: 'no-human-edits',
      skipReason: 'no-human-edits',
      aiSpent: 0,
    })
  })

  it('records a failure rather than swallowing it, and rethrows', async () => {
    const {client, engine, patches} = documentTier({
      breakHistory: true,
      human: {title: 'Das Dataset Handbuch', body: 'Das Dataset wird im Content Lake abgelegt.'},
    })

    // `breakHistory` throws something other than a 404, which is a real fault
    // rather than an expired revision.
    await expect(run(client, engine)).rejects.toThrow(/history exploded/)

    const settle = patches.find((patch) => patch.id === claimId(PARENT))
    expect(settle?.operations.set).toMatchObject({status: 'failed', detail: 'history exploded'})
  })
})

// --- The gather paths, per tier ---------------------------------------------

describe('the document tier', () => {
  it('diffs the machine draft against the approved sibling document', async () => {
    const {client, engine, prompts} = documentTier({
      promptResponse: TERM_PROPOSAL,
      human: {title: 'Das Dataset Handbuch', body: 'Das Dataset wird im Content Lake abgelegt.'},
    })

    const result = await run(client, engine)

    expect(result.aiSpent).toBe(1)
    expect(prompts[0]).toContain('Das Dataset wird im Content Lake abgelegt.')
    expect(prompts[0]).toContain('Der Datensatz wird im Content Lake gespeichert.')
    expect(prompts[0]).toContain(SOURCE_TEXT)
  })

  it('reads the machine side at the draft id the revision belongs to', async () => {
    const {client, engine, historyUrls} = documentTier({
      human: {title: 'Das Dataset Handbuch', body: 'Das Dataset wird im Content Lake abgelegt.'},
    })

    await run(client, engine)

    // `machineRev` is a revision of the DRAFT the handler wrote, not of the
    // published document — asking for the published id would 404 forever.
    expect(historyUrls).toEqual([
      `/data/history/${CONTENT_DATASET}/documents/drafts.article-1-de?revision=rev-m-de`,
    ])
  })
})

describe('the field tier', () => {
  it('reduces both sides to the locale under test before diffing', async () => {
    const {client, engine, prompts} = fieldTier({
      promptResponse: TERM_PROPOSAL,
      bio: {'de-DE': 'Das Dataset wird im Content Lake abgelegt und mit GROQ gelesen.'},
    })

    const result = await run(client, engine)

    expect(result.aiSpent).toBe(1)
    expect(prompts[0]).toContain('Das Dataset wird im Content Lake abgelegt und mit GROQ gelesen.')
    // The source-locale entry is the source, and it is not mistaken for a target.
    expect(prompts[0]).toContain(SOURCE_TEXT)
  })

  it('does not see its own English entry as a locale edit', async () => {
    const {client, engine} = fieldTier({
      bio: {'de-DE': 'Der Datensatz wird im Content Lake gespeichert und mit GROQ abgefragt.'},
    })
    // The de-DE entry is untouched, so the only difference between the two
    // documents is the machine revision's own metadata — which the projection
    // reduces away.
    const result = await run(client, engine)
    expect(result.outcome).toBe('no-human-edits')
    expect(result.aiSpent).toBe(0)
  })
})

describe('a release-scoped run', () => {
  it('reads the version document, not the draft beside it', async () => {
    const {client, engine, prompts} = releaseTier({
      promptResponse: JSON.stringify({proposals: []}),
      human: 'Das Dataset Handbuch fuer alle',
    })

    const result = await run(client, engine)

    expect(result.aiSpent).toBe(1)
    expect(prompts[0]).toContain('Das Dataset Handbuch fuer alle')
    expect(prompts[0]).not.toContain('Ein ganz anderer Entwurf')
  })

  it('is distilled like any other run rather than excluded', async () => {
    const {client, engine} = releaseTier({human: 'Das Dataset Handbuch fuer alle'})
    const result = await run(client, engine)
    expect(result.locales).toEqual(['de-DE'])
  })
})

// --- Degrading -------------------------------------------------------------

describe('degrading', () => {
  it('proposes nothing when the machine revision has aged out', async () => {
    const {client, engine, prompts, writes} = documentTier({
      // Recorded on the child, but outside the dataset's retention window — and
      // the `?time=` fallback finds nothing either.
      machineRev: 'rev-expired',
      human: {title: 'Das Dataset Handbuch', body: 'Das Dataset wird im Content Lake abgelegt.'},
    })

    const result = await run(client, engine)

    expect(result.outcome).toBe('history-unavailable')
    expect(result.aiSpent).toBe(0)
    expect(prompts).toEqual([])
    expect(writes.filter((write) => write._type === 'l10n.proposal')).toEqual([])
  })

  /**
   * `machineRev` is absent exactly when the write was a no-op: a redelivered
   * effect that found the release version it had already created is answered with
   * a transaction id for a commit it did not make, so the handler records nothing.
   * Without the fallback that locale would be lost from the corpus forever.
   */
  it('falls back to the effect’s completion instant when no revision was recorded', async () => {
    const {client, engine, historyUrls, prompts} = documentTier({
      machineRev: null,
      promptResponse: TERM_PROPOSAL,
      human: {title: 'Das Dataset Handbuch', body: 'Das Dataset wird im Content Lake abgelegt.'},
      revisions: {
        [`drafts.article-1-de@${RAN_AT}`]: {
          _id: 'drafts.article-1-de',
          _type: 'article',
          title: 'Der Datensatz Leitfaden',
          body: [block('Der Datensatz wird im Content Lake gespeichert.')],
        },
      },
    })

    const result = await run(client, engine)

    expect(result.outcome).toBe('distilled')
    expect(prompts).toHaveLength(1)
    // `?time=`, never an interval: `ranAt` stamps at completion and `durationMs`
    // is never written, so there is no start to bracket from.
    expect(historyUrls).toEqual([
      `/data/history/${CONTENT_DATASET}/documents/drafts.article-1-de?time=${encodeURIComponent(RAN_AT)}`,
    ])
  })

  it('harvests no eval case from a locale it could only reach by timestamp', async () => {
    const {client, engine, writes} = documentTier({
      machineRev: null,
      human: {
        title: 'Der Datensatz Leitfaden',
        body: 'Der Datensatz wird im Content Lake gespeichert.',
      },
      revisions: {
        [`drafts.article-1-de@${RAN_AT}`]: {
          _id: 'drafts.article-1-de',
          _type: 'article',
          title: 'Der Datensatz Leitfaden',
          body: [block('Der Datensatz wird im Content Lake gespeichert.')],
        },
      },
    })

    const result = await run(client, engine)

    // The machine output matched, so it would be a free case — but its
    // coordinates would carry no revision, and a case a script cannot resolve is
    // not a case.
    expect(result.outcome).toBe('no-human-edits')
    expect(writes.filter((write) => write._type === 'l10n.proposal')).toEqual([])
  })

  it('stops when the source moved and the analyzed revision is unreadable', async () => {
    const instance = parentInstance({
      fields: [
        docRef('subject', 'article-1', 'article'),
        stringField('analyzedRev', 'rev-analyzed'),
        {
          _key: 'sourceChanged',
          _type: 'boolean',
          name: 'sourceChanged',
          value: true,
        } as unknown as ResolvedFieldEntry,
        localesField(['de-DE']),
      ],
      locales: ['de-DE'],
    })
    const test = harness({
      documents: {
        'drafts.article-1': {_id: 'drafts.article-1', _type: 'article', title: 'The dataset guide'},
      },
      revisions: {},
    })

    const result = await run(
      test.client,
      engineFor(instance, [
        childInstance({
          locale: 'de-DE',
          targetId: 'article-1-de',
          targetType: 'article',
          machineRev: 'rev-m-de',
        }),
      ]),
    )

    expect(result.outcome).toBe('source-drift')
    expect(result.aiSpent).toBe(0)
    expect(test.prompts).toEqual([])
  })

  it('stops when the subject is gone', async () => {
    const instance = parentInstance({
      fields: [docRef('subject', 'article-1', 'article'), localesField(['de-DE'])],
      locales: ['de-DE'],
    })
    const test = harness({documents: {}})

    const result = await run(test.client, engineFor(instance, []))

    expect(result.outcome).toBe('no-subject')
    expect(test.prompts).toEqual([])
  })

  it('stops when no locale translated', async () => {
    const instance = parentInstance({
      fields: [docRef('subject', 'article-1', 'article'), localesField([])],
      locales: [],
    })
    const test = harness({
      documents: {
        'drafts.article-1': {_id: 'drafts.article-1', _type: 'article', title: 'The dataset guide'},
      },
    })

    const result = await run(test.client, engineFor(instance, []))

    expect(result.outcome).toBe('no-translated-locales')
    expect(test.prompts).toEqual([])
  })
})

// --- The gate, from the outside -------------------------------------------

describe('spending', () => {
  it('spends nothing on a punctuation fix', async () => {
    const {client, engine, prompts, writes} = documentTier({
      human: {
        title: 'Der Datensatz Leitfaden!',
        body: 'Der Datensatz wird im Content Lake gespeichert!',
      },
    })

    const result = await run(client, engine)

    expect(result.aiSpent).toBe(0)
    expect(prompts).toEqual([])
    // The claim, plus one harvested eval case. No proposal from a model.
    expect(writes.filter((write) => write._type === 'l10n.proposal')).toHaveLength(1)
  })

  it('spends nothing below the changed-word threshold', async () => {
    const {client, engine, prompts} = documentTier({
      human: {
        title: 'Der Datensatz Leitfaden',
        // One word swapped in one field.
        body: 'Der Datensatz wird im Content Lake abgelegt.',
      },
    })

    const result = await run(client, engine)

    expect(result.outcome).toBe('below-threshold')
    expect(result.aiSpent).toBe(0)
    expect(prompts).toEqual([])
  })

  it('asks once for the whole run, not once per locale', async () => {
    const instance = parentInstance({
      fields: [docRef('subject', 'article-1', 'article'), localesField(['de-DE', 'fr-FR'])],
      locales: ['de-DE', 'fr-FR'],
    })
    const test = harness({
      documents: {
        'drafts.article-1': {
          _id: 'drafts.article-1',
          _type: 'article',
          title: 'The dataset guide',
          body: [block(SOURCE_TEXT)],
        },
        'drafts.article-1-de': {
          _id: 'drafts.article-1-de',
          _type: 'article',
          title: 'Das Dataset Handbuch',
        },
        'drafts.article-1-fr': {
          _id: 'drafts.article-1-fr',
          _type: 'article',
          title: 'Le guide du Dataset',
        },
      },
      revisions: {
        'drafts.article-1-de@rev-m-de': {
          _id: 'drafts.article-1-de',
          _type: 'article',
          title: 'Der Datensatz Leitfaden',
        },
        'drafts.article-1-fr@rev-m-fr': {
          _id: 'drafts.article-1-fr',
          _type: 'article',
          title: 'Le guide des jeux de donnees',
        },
      },
    })

    const result = await run(
      test.client,
      engineFor(instance, [
        childInstance({
          locale: 'de-DE',
          targetId: 'article-1-de',
          targetType: 'article',
          machineRev: 'rev-m-de',
        }),
        childInstance({
          locale: 'fr-FR',
          targetId: 'article-1-fr',
          targetType: 'article',
          machineRev: 'rev-m-fr',
        }),
      ]),
    )

    expect(result.aiSpent).toBe(1)
    expect(test.prompts).toHaveLength(1)
    expect(test.prompts[0]).toContain('## de-DE')
    expect(test.prompts[0]).toContain('## fr-FR')
  })
})

// --- What gets written ---------------------------------------------------

describe('the proposals written', () => {
  it('writes a draft that collapses onto itself on a repeat, bumping occurrences', async () => {
    const {client, engine, patches, writes} = documentTier({
      promptResponse: TERM_PROPOSAL,
      human: {title: 'Das Dataset Handbuch', body: 'Das Dataset wird im Content Lake abgelegt.'},
    })

    await run(client, engine)

    const proposal = writes.find((write) => write._type === 'l10n.proposal')
    expect(proposal).toBeDefined()
    expect(String(proposal?._id)).toMatch(/^drafts\.l10n\.proposal\./)
    expect(proposal).toMatchObject({
      kind: 'glossary-term',
      locale: 'de-DE',
      term: 'dataset',
      translation: 'Dataset',
      occurrences: 0,
      run: PARENT,
      subject: {_type: 'reference', _ref: 'article-1', _weak: true},
    })
    expect(proposal?.evidence).toMatchObject({
      fieldPath: 'body',
      machineText: 'Der Datensatz wird im Content Lake gespeichert.',
      humanText: 'Das Dataset wird im Content Lake abgelegt.',
    })

    const bump = patches.find((patch) => patch.id === proposal?._id)
    expect(bump?.operations).toEqual({inc: {occurrences: 1}})
  })

  it('never writes a do-not-translate instruction, whatever the model asked for', async () => {
    const {client, engine, writes} = documentTier({
      promptResponse: JSON.stringify({
        proposals: [
          {
            kind: 'glossary-term',
            locale: 'de-DE',
            term: 'dataset',
            translation: 'Dataset',
            doNotTranslate: true,
            fieldPath: 'body',
            rationale: 'The reviewer kept the English word.',
          },
        ],
      }),
      human: {title: 'Das Dataset Handbuch', body: 'Das Dataset wird im Content Lake abgelegt.'},
    })

    const result = await run(client, engine)

    expect(JSON.stringify(writes)).not.toContain('doNotTranslate')
    expect(result.proposals).toBe(0)
  })

  it('drops a proposal quoting text that is not there', async () => {
    const {client, engine, writes} = documentTier({
      promptResponse: JSON.stringify({
        proposals: [
          {
            kind: 'glossary-term',
            locale: 'de-DE',
            term: 'warehouse',
            translation: 'Lagerhaus',
            fieldPath: 'body',
            rationale: 'Invented from nothing.',
          },
        ],
      }),
      human: {title: 'Das Dataset Handbuch', body: 'Das Dataset wird im Content Lake abgelegt.'},
    })

    await run(client, engine)
    expect(writes.filter((write) => write._type === 'l10n.proposal')).toEqual([])
  })

  it('harvests an eval case from a locale the reviewer left alone, with no AI', async () => {
    const {client, engine, prompts, writes} = documentTier({
      human: {
        title: 'Der Datensatz Leitfaden',
        body: 'Der Datensatz wird im Content Lake gespeichert.',
      },
    })

    const result = await run(client, engine)

    expect(result.outcome).toBe('no-human-edits')
    expect(result.aiSpent).toBe(0)
    expect(prompts).toEqual([])

    const evalCase = writes.find((write) => write.kind === 'eval-case')
    expect(evalCase).toMatchObject({
      kind: 'eval-case',
      locale: 'de-DE',
      coordinates: {
        locale: 'de-DE',
        targetId: 'drafts.article-1-de',
        targetRev: 'rev-m-de',
      },
    })
    expect(String(evalCase?._id)).toMatch(/^drafts\.l10n\.proposal\./)
  })

  it('harvests eval cases alongside proposals when only some locales were edited', async () => {
    const instance = parentInstance({
      fields: [docRef('subject', 'article-1', 'article'), localesField(['de-DE', 'fr-FR'])],
      locales: ['de-DE', 'fr-FR'],
    })
    const test = harness({
      promptResponse: TERM_PROPOSAL,
      documents: {
        'drafts.article-1': {
          _id: 'drafts.article-1',
          _type: 'article',
          title: 'The dataset guide',
          body: [block(SOURCE_TEXT)],
        },
        'drafts.article-1-de': {
          _id: 'drafts.article-1-de',
          _type: 'article',
          title: 'Das Dataset Handbuch',
          body: [block('Das Dataset wird im Content Lake abgelegt.')],
        },
        'drafts.article-1-fr': {
          _id: 'drafts.article-1-fr',
          _type: 'article',
          title: 'Le guide du jeu de donnees',
        },
      },
      revisions: {
        'drafts.article-1-de@rev-m-de': {
          _id: 'drafts.article-1-de',
          _type: 'article',
          title: 'Der Datensatz Leitfaden',
          body: [block('Der Datensatz wird im Content Lake gespeichert.')],
        },
        'drafts.article-1-fr@rev-m-fr': {
          _id: 'drafts.article-1-fr',
          _type: 'article',
          title: 'Le guide du jeu de donnees',
        },
      },
    })

    await run(
      test.client,
      engineFor(instance, [
        childInstance({
          locale: 'de-DE',
          targetId: 'article-1-de',
          targetType: 'article',
          machineRev: 'rev-m-de',
        }),
        childInstance({
          locale: 'fr-FR',
          targetId: 'article-1-fr',
          targetType: 'article',
          machineRev: 'rev-m-fr',
        }),
      ]),
    )

    const kinds = test.writes
      .filter((write) => write._type === 'l10n.proposal')
      .map((write) => `${write.kind}:${write.locale}`)
    expect(kinds).toContain('eval-case:fr-FR')
    expect(kinds).toContain('glossary-term:de-DE')
    expect(kinds).not.toContain('eval-case:de-DE')
  })
})
