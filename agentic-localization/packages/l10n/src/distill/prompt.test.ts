import {describe, expect, it} from 'vitest'

import type {LocaleDelta} from '../core/distillDelta'

import {buildDistillPrompt, buildLocaleSummary} from './prompt'

function localeDelta(overrides: Partial<LocaleDelta> & {locale: string}): LocaleDelta {
  return {
    spans: [
      {
        fieldPath: 'bio',
        machineText: 'Der Datensatz wird gespeichert',
        humanText: 'Das Dataset wird abgelegt',
        changedWords: 4,
        changedRatio: 0.4,
      },
    ],
    changedWords: 4,
    changedRatio: 0.4,
    styleOnly: false,
    ...overrides,
  }
}

describe('buildLocaleSummary', () => {
  it('shows both sides of every span, under a locale heading', () => {
    const summary = buildLocaleSummary([localeDelta({locale: 'de-DE'})])
    expect(summary).toContain('## de-DE')
    expect(summary).toContain('machine: "Der Datensatz wird gespeichert"')
    expect(summary).toContain('human:   "Das Dataset wird abgelegt"')
  })

  // The model is told, per locale, when terminology is off the table — the
  // validation drops such a term anyway, so saying so saves a wasted proposal.
  it('marks a wholesale rewrite in the heading', () => {
    const summary = buildLocaleSummary([localeDelta({locale: 'fr-FR', styleOnly: true})])
    expect(summary).toContain('## fr-FR (wholesale rewrite — style rules only)')
  })

  it('keeps locales apart', () => {
    const summary = buildLocaleSummary([
      localeDelta({locale: 'de-DE'}),
      localeDelta({locale: 'fr-FR'}),
    ])
    expect(summary.indexOf('## de-DE')).toBeLessThan(summary.indexOf('## fr-FR'))
  })

  it('is empty for no edited locales — the caller skips before it gets here', () => {
    expect(buildLocaleSummary([])).toBe('')
  })
})

describe('buildDistillPrompt', () => {
  const args = {
    locales: [localeDelta({locale: 'de-DE'})],
    sourceText: 'The dataset is stored in the Content Lake.',
    sourceLanguage: 'en-US',
  }

  it('interpolates the source, the language and the corrections', () => {
    const prompt = buildDistillPrompt(args)
    expect(prompt).toContain('Source language: en-US')
    expect(prompt).toContain(args.sourceText)
    expect(prompt).toContain('## de-DE')
    expect(prompt).not.toContain('$sourceText')
    expect(prompt).not.toContain('$localeSummary')
    expect(prompt).not.toContain('$sourceLanguage')
  })

  it('states the do-not-translate prohibition in the instruction itself', () => {
    expect(buildDistillPrompt(args)).toContain(
      'NEVER propose that a term should be left untranslated',
    )
  })

  /**
   * Interpolated values are translated prose. A `$&` in a string replacement is
   * a substitution pattern, so the reviewer's own text would be rewritten into
   * the prompt as something they never wrote.
   */
  it('carries a dollar sequence through verbatim', () => {
    const prompt = buildDistillPrompt({
      ...args,
      sourceText: 'Pay $& now',
      locales: [
        localeDelta({
          locale: 'de-DE',
          spans: [
            {
              fieldPath: 'bio',
              machineText: "Zahle $' jetzt",
              humanText: 'Zahlen Sie $& jetzt',
              changedWords: 3,
              changedRatio: 0.3,
            },
          ],
        }),
      ],
    })
    expect(prompt).toContain('Pay $& now')
    expect(prompt).toContain("Zahle $' jetzt")
    expect(prompt).toContain('Zahlen Sie $& jetzt')
  })

  it('caps a runaway source text rather than sending it whole', () => {
    const prompt = buildDistillPrompt({...args, sourceText: 'x'.repeat(5_000)})
    expect(prompt).toContain('…[truncated]')
    expect(prompt.length).toBeLessThan(5_000)
  })
})
