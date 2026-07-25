/**
 * `@starter/l10n/distill`
 *
 * The self-reinforcing loop: use generates context.
 *
 * An approved localization run is a corpus of one — machine output, and the text
 * a human decided to ship instead. This entry turns that into DRAFT
 * `l10n.proposal` documents: glossary terms, style rules, and eval-case
 * coordinates. A reviewer accepts them into a glossary or a style guide, and
 * prompt assembly (`@starter/l10n/prompts`) picks them up on the next run.
 *
 * An observer of finished runs, not a phase of one — see
 * `docs/decisions/adr-002-learning-loop.md`. Nothing here can fail a
 * localization run, and nothing here decides anything.
 *
 * React-free, like the rest of the node floor: this runs inside a Sanity Function.
 */

export {
  CLAIM_RETENTION_MS,
  claimId,
  distillReview,
  type DistillOutcome,
  type DistillReviewArgs,
  type DistillReviewResult,
} from './distillReview'

export {
  gatherRun,
  type DistillClient,
  type DistillEngine,
  type DistillPatchOperations,
  type DistillTransaction,
  type GatheredLocale,
  type GatheredRun,
  type GatherSkipReason,
} from './gather'

export {
  buildDistillPrompt,
  buildLocaleSummary,
  DISTILL_PROMPT_INSTRUCTION,
  type DistillPromptArgs,
} from './prompt'

export {
  evalCaseDocumentFor,
  isProposalKind,
  MODEL_PROPOSAL_KINDS,
  parseProposalResponse,
  PROPOSAL_KINDS,
  proposalDocumentFor,
  proposalDraftId,
  proposalId,
  proposalKey,
  type EvalCaseCoordinates,
  type ModelProposal,
  type ModelProposalKind,
  type ParsedProposals,
  type ProposalDocument,
  type ProposalEvidence,
  type ProposalKind,
  type ProposalValidationContext,
} from './proposals'
