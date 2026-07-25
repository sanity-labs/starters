/**
 * What the learning loop is allowed to propose.
 *
 * In `core/` rather than in `src/distill/` so the Studio can read the vocabulary
 * without importing the loop — the schema and the Accept action need the kinds,
 * and `src/distill/proposals.ts` reaches for `node:crypto`, which has no place in
 * a browser bundle.
 */

/** Every kind the `l10n.proposal` schema accepts. */
export const PROPOSAL_KINDS = ['glossary-term', 'style-rule', 'eval-case'] as const

export type ProposalKind = (typeof PROPOSAL_KINDS)[number]

/**
 * The kinds a model may propose. `eval-case` is deliberately absent: a case is
 * harvested from coordinates a run already recorded, so the model gets no say in
 * what its own output proved.
 */
export const MODEL_PROPOSAL_KINDS = ['glossary-term', 'style-rule'] as const

export type ModelProposalKind = (typeof MODEL_PROPOSAL_KINDS)[number]

export function isProposalKind(value: unknown): value is ProposalKind {
  return PROPOSAL_KINDS.some((kind) => kind === value)
}
