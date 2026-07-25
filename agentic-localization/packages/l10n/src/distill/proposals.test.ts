import {describe, expect, it} from 'vitest'

import type {ProposalValidationContext} from './proposals'

import {
  evalCaseDocumentFor,
  MODEL_PROPOSAL_KINDS,
  parseProposalResponse,
  proposalDocumentFor,
  proposalDraftId,
  proposalId,
  proposalKey,
} from './proposals'

const SOURCE = 'The dataset is stored in the Content Lake and queried with GROQ.'
const HUMAN_DE = 'Das Dataset liegt im Content Lake und wird mit GROQ abgefragt.'

const CONTEXT: ProposalValidationContext = {
  locales: new Set(['de-DE', 'fr-FR']),
  sourceText: SOURCE,
  humanTextByLocale: new Map([['de-DE', HUMAN_DE]]),
  styleOnlyLocales: new Set(),
}

const TERM_ROW = {
  kind: 'glossary-term',
  locale: 'de-DE',
  term: 'dataset',
  translation: 'Dataset',
  fieldPath: 'bio',
  rationale: 'The team ships the English product term.',
}

const RULE_ROW = {
  kind: 'style-rule',
  locale: 'de-DE',
  rule: 'Use the passive for system actions.',
  fieldPath: 'bio',
  rationale: 'The reviewer rewrote the active clause.',
}

function respond(rows: unknown[]): string {
  return JSON.stringify({proposals: rows})
}

const EVIDENCE = {
  fieldPath: 'bio',
  sourceExcerpt: SOURCE,
  machineText: 'Der Datensatz liegt im Content Lake',
  humanText: 'Das Dataset liegt im Content Lake',
}

describe('proposal identity', () => {
  it('is deterministic for the same conclusion', () => {
    const key = proposalKey({
      kind: 'glossary-term',
      locale: 'de-DE',
      term: 'dataset',
      correctedForm: 'Dataset',
    })
    expect(proposalId(key)).toBe(proposalId(key))
    expect(proposalId(key)).toMatch(/^l10n\.proposal\.[0-9a-f]{16}$/)
  })

  it('separates the four things that make a proposal different', () => {
    const base = {
      kind: 'glossary-term',
      locale: 'de-DE',
      term: 'dataset',
      correctedForm: 'Dataset',
    } as const
    const ids = [
      base,
      {...base, kind: 'style-rule'} as const,
      {...base, locale: 'fr-FR'},
      {...base, term: 'field'},
      {...base, correctedForm: 'Datensatz'},
    ].map((proposal) => proposalId(proposalKey(proposal)))

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keys a style rule off the rule text', () => {
    const one = proposalKey({kind: 'style-rule', locale: 'de-DE', rule: 'Use Sie.'})
    const two = proposalKey({kind: 'style-rule', locale: 'de-DE', rule: 'Use du.'})
    expect(proposalId(one)).not.toBe(proposalId(two))
  })

  // Two runs reaching the same conclusion must land on one document so the
  // second only bumps `occurrences` — otherwise the reviewer triages duplicates.
  it('collapses cross-run repeats onto one draft id', () => {
    const first = proposalDocumentFor({
      proposal: {...TERM_ROW, kind: 'glossary-term'},
      evidence: EVIDENCE,
      run: 'wf-instance-1',
      subjectId: 'person-ada',
    })
    const second = proposalDocumentFor({
      proposal: {...TERM_ROW, kind: 'glossary-term', rationale: 'Different words, same claim.'},
      evidence: {...EVIDENCE, machineText: 'something else entirely'},
      run: 'wf-instance-2',
      subjectId: 'person-grace',
    })
    expect(first._id).toBe(second._id)
  })

  it('writes to a draft id, never a published one', () => {
    expect(proposalDraftId('anything')).toMatch(/^drafts\.l10n\.proposal\./)
  })
})

describe('parseProposalResponse', () => {
  it('keeps a verifiable term and a rule', () => {
    const {dropped, proposals} = parseProposalResponse(respond([TERM_ROW, RULE_ROW]), CONTEXT)
    expect(dropped).toBe(0)
    expect(proposals).toEqual([
      {
        kind: 'glossary-term',
        locale: 'de-DE',
        fieldPath: 'bio',
        rationale: 'The team ships the English product term.',
        term: 'dataset',
        translation: 'Dataset',
      },
      {
        kind: 'style-rule',
        locale: 'de-DE',
        fieldPath: 'bio',
        rationale: 'The reviewer rewrote the active clause.',
        rule: 'Use the passive for system actions.',
      },
    ])
  })

  it('strips markdown fences the model adds anyway', () => {
    const raw = `\`\`\`json\n${respond([RULE_ROW])}\n\`\`\``
    expect(parseProposalResponse(raw, CONTEXT).proposals).toHaveLength(1)
  })

  it('refuses a response that is not the documented shape', () => {
    expect(() => parseProposalResponse('[]', CONTEXT)).toThrow(/not a JSON object/)
    expect(() => parseProposalResponse('{}', CONTEXT)).toThrow(/missing proposals/)
  })

  it('accepts an empty proposal list as a real answer', () => {
    expect(parseProposalResponse(respond([]), CONTEXT)).toEqual({proposals: [], dropped: 0})
  })

  it('drops a kind the model is not allowed to propose', () => {
    const {dropped, proposals} = parseProposalResponse(
      respond([
        {...RULE_ROW, kind: 'eval-case'},
        {...RULE_ROW, kind: 'do-not-translate'},
        {...RULE_ROW, kind: 42},
      ]),
      CONTEXT,
    )
    expect(proposals).toEqual([])
    expect(dropped).toBe(3)
    expect(MODEL_PROPOSAL_KINDS).not.toContain('eval-case')
  })

  it('drops a locale that is not configured', () => {
    const {proposals} = parseProposalResponse(respond([{...RULE_ROW, locale: 'xx-XX'}]), CONTEXT)
    expect(proposals).toEqual([])
  })

  it('drops a row with no rationale', () => {
    const {proposals} = parseProposalResponse(
      respond([
        {...RULE_ROW, rationale: '   '},
        {...RULE_ROW, rationale: undefined},
      ]),
      CONTEXT,
    )
    expect(proposals).toEqual([])
  })

  it('drops a term that does not appear verbatim in the source', () => {
    const {proposals} = parseProposalResponse(
      respond([
        {...TERM_ROW, term: 'datasets'},
        {...TERM_ROW, term: 'Dataset'},
      ]),
      CONTEXT,
    )
    expect(proposals).toEqual([])
  })

  it('drops a translation that does not appear verbatim in the approved text', () => {
    const {proposals} = parseProposalResponse(
      respond([{...TERM_ROW, translation: 'Datenbestand'}]),
      CONTEXT,
    )
    expect(proposals).toEqual([])
  })

  it('drops a term for a locale with no approved text at all', () => {
    const {proposals} = parseProposalResponse(
      respond([{...TERM_ROW, locale: 'fr-FR', translation: 'Dataset'}]),
      CONTEXT,
    )
    expect(proposals).toEqual([])
  })

  it('drops a term proposed for a wholesale rewrite but keeps its style rule', () => {
    const context = {...CONTEXT, styleOnlyLocales: new Set(['de-DE'])}
    const {proposals} = parseProposalResponse(respond([TERM_ROW, RULE_ROW]), context)
    expect(proposals.map((proposal) => proposal.kind)).toEqual(['style-rule'])
  })

  it('drops a row missing its kind payload', () => {
    const {proposals} = parseProposalResponse(
      respond([
        {...TERM_ROW, term: undefined},
        {...TERM_ROW, translation: ''},
        {...RULE_ROW, rule: ''},
      ]),
      CONTEXT,
    )
    expect(proposals).toEqual([])
  })

  it('deduplicates rows that say the same thing', () => {
    const {dropped, proposals} = parseProposalResponse(
      respond([TERM_ROW, {...TERM_ROW, rationale: 'Said twice.'}]),
      CONTEXT,
    )
    expect(proposals).toHaveLength(1)
    expect(dropped).toBe(1)
  })

  it('trims whitespace the model leaves around its quotes', () => {
    const {proposals} = parseProposalResponse(
      respond([{...TERM_ROW, term: ' dataset ', translation: ' Dataset '}]),
      CONTEXT,
    )
    expect(proposals[0]).toMatchObject({term: 'dataset', translation: 'Dataset'})
  })
})

/**
 * The hard rule. Pinning a phrase in the source language is a brand decision,
 * and a single diff is not evidence of one — a translator dropping a word once
 * would otherwise teach the loop to stop translating it forever.
 */
describe('the do-not-translate prohibition', () => {
  it('drops a row that asks for it, whatever else the row says', () => {
    const {dropped, proposals} = parseProposalResponse(
      respond([
        {...TERM_ROW, doNotTranslate: true},
        {...RULE_ROW, doNotTranslate: true},
      ]),
      CONTEXT,
    )
    expect(proposals).toEqual([])
    expect(dropped).toBe(2)
  })

  it('never appears on a document either builder emits', () => {
    const documents = [
      proposalDocumentFor({
        proposal: {...TERM_ROW, kind: 'glossary-term'},
        evidence: EVIDENCE,
        run: 'wf-1',
        subjectId: 'person-ada',
      }),
      proposalDocumentFor({
        proposal: {...RULE_ROW, kind: 'style-rule'},
        evidence: EVIDENCE,
        run: 'wf-1',
        subjectId: 'person-ada',
      }),
      evalCaseDocumentFor({
        coordinates: {
          locale: 'de-DE',
          targetId: 'drafts.person-ada',
          targetRev: 'rev-machine',
          sourceRev: 'rev-source',
        },
        run: 'wf-1',
        subjectId: 'person-ada',
        rationale: 'Approved unedited.',
      }),
    ]

    for (const document of documents) {
      expect(JSON.stringify(document)).not.toContain('doNotTranslate')
    }
  })
})

describe('proposalDocumentFor', () => {
  const document = proposalDocumentFor({
    proposal: {...TERM_ROW, kind: 'glossary-term'},
    evidence: EVIDENCE,
    run: 'wf-instance-1',
    subjectId: 'person-ada',
  })

  it('lands as a draft of the l10n.proposal type', () => {
    expect(document._id.startsWith('drafts.')).toBe(true)
    expect(document._type).toBe('l10n.proposal')
  })

  it('starts at zero occurrences, for the write path to increment', () => {
    expect(document.occurrences).toBe(0)
  })

  it('carries the evidence a reviewer judges it on', () => {
    expect(document.evidence).toEqual(EVIDENCE)
  })

  it('references the subject weakly — it may be deleted before review', () => {
    expect(document.subject).toEqual({_type: 'reference', _ref: 'person-ada', _weak: true})
  })

  it('records the run as a plain string: the instance lives in another dataset', () => {
    expect(document.run).toBe('wf-instance-1')
  })

  it('omits the payload of the other kinds', () => {
    expect(document.rule).toBeUndefined()
    expect(document.coordinates).toBeUndefined()
  })
})

describe('evalCaseDocumentFor', () => {
  const coordinates = {
    locale: 'de-DE',
    targetId: 'versions.summer.article-1-de',
    targetRev: 'rev-machine',
    sourceRev: 'rev-source',
  }
  const document = evalCaseDocumentFor({
    coordinates,
    run: 'wf-1',
    subjectId: 'article-1',
    rationale: 'Approved unedited.',
  })

  it('carries coordinates rather than a materialized fixture', () => {
    expect(document.kind).toBe('eval-case')
    expect(document.coordinates).toEqual(coordinates)
    expect(document.term).toBeUndefined()
    expect(document.rule).toBeUndefined()
  })

  it('is unique per target revision, so a re-approval is a second case', () => {
    const later = evalCaseDocumentFor({
      coordinates: {...coordinates, targetRev: 'rev-machine-2'},
      run: 'wf-2',
      subjectId: 'article-1',
      rationale: 'Approved unedited.',
    })
    expect(later._id).not.toBe(document._id)
  })
})
