/**
 * One prompt per approved run, for every locale at once.
 *
 * Per-locale prompting would scale the loop's cost with the fan-out it observes,
 * and the interesting signal is cross-locale anyway: a term three markets all
 * corrected the same way is a glossary entry, while one market's single fix is
 * usually a preference.
 *
 * The model sees only what the gate let through — normalized machine text, the
 * human text beside it, and the source sentence. It never sees the documents.
 */

import type {LocaleDelta} from '../core/distillDelta'

/** How much of one side of a span the prompt carries. */
const SPAN_CAP = 600

/** And how much of the source text. */
const SOURCE_CAP = 2_000

export interface DistillPromptArgs {
  /** Only the locales a human edited. Each carries its own style-only verdict. */
  locales: readonly LocaleDelta[]
  /** The source text the machine translated from — the term haystack. */
  sourceText: string
  sourceLanguage: string
}

export const DISTILL_PROMPT_INSTRUCTION = `You are reviewing corrections a human made to machine translations that have just been approved for publication.

Your job is to name what the machine got wrong, so the next translation gets it right. You are proposing DRAFT entries for a human to accept or reject — be precise and conservative rather than comprehensive. A wrong proposal costs a reviewer's attention; a missing one costs nothing.

Source language: $sourceLanguage

Source text the machine translated from:
"""
$sourceText
"""

Corrections, per locale:

$localeSummary

Respond with a JSON object (no markdown fences, no explanation outside the JSON):
{
  "proposals": [
    {
      "kind": "glossary-term",
      "locale": "the locale code exactly as given above",
      "term": "the word or phrase in the SOURCE text, copied verbatim from the source text above",
      "translation": "what the human used instead, copied verbatim from that locale's corrected text",
      "fieldPath": "the field the correction was in",
      "rationale": "one sentence: why this is the right translation of the term"
    },
    {
      "kind": "style-rule",
      "locale": "the locale code exactly as given above",
      "rule": "one instruction in the imperative, e.g. 'Address the reader as \\"Sie\\", never \\"du\\".'",
      "fieldPath": "the field the correction was in",
      "rationale": "one sentence: which correction shows this"
    }
  ]
}

Rules:
- "term" MUST be a verbatim substring of the source text above, and "translation" MUST be a verbatim substring of that locale's corrected text. A proposal that quotes either loosely is discarded.
- Propose a "glossary-term" only when the same source word or phrase was translated differently by the human. If the whole sentence was rewritten, that is a style rule, not a term.
- Locales marked "wholesale rewrite" below: propose style rules for them ONLY. No terminology.
- Propose a "style-rule" only for something that generalizes beyond this document — register, address form, punctuation convention, sentence length. Never restate the correction itself as a rule.
- Prefer a pattern several locales share over one locale's single fix.
- NEVER propose that a term should be left untranslated. That is a brand decision, and a single correction is not evidence of one.
- An empty "proposals" array is the right answer when the corrections are only preference. Say nothing rather than guess.`

/** The per-locale block the instruction interpolates. */
export function buildLocaleSummary(locales: readonly LocaleDelta[]): string {
  return locales
    .map((locale) => {
      const heading = locale.styleOnly
        ? `## ${locale.locale} (wholesale rewrite — style rules only)`
        : `## ${locale.locale}`
      const spans = locale.spans.map(
        (span) =>
          `- ${span.fieldPath}\n` +
          `  machine: "${cap(span.machineText)}"\n` +
          `  human:   "${cap(span.humanText)}"`,
      )
      return [heading, ...spans].join('\n')
    })
    .join('\n\n')
}

/**
 * Function replacements, not string ones: the interpolated values are translated
 * prose, and a `$&` or `$'` in a string replacement is a substitution pattern
 * rather than the characters a human typed.
 */
export function buildDistillPrompt(args: DistillPromptArgs): string {
  return DISTILL_PROMPT_INSTRUCTION.replace('$sourceLanguage', () => args.sourceLanguage)
    .replace('$sourceText', () => cap(args.sourceText, SOURCE_CAP))
    .replace('$localeSummary', () => buildLocaleSummary(args.locales))
}

function cap(value: string, max = SPAN_CAP): string {
  return value.length <= max ? value : `${value.slice(0, max)}…[truncated]`
}
