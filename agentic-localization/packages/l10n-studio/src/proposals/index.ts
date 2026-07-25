/**
 * The reviewer's side of the learning loop.
 *
 * `distill-review` writes DRAFT `l10n.proposal` documents; this is where a human
 * turns one into content. Accept appends to the target's draft with an explicit
 * `approved` status and deletes the proposal; Reject deletes it.
 */

export {
  ACCEPT_TARGETS_QUERY,
  acceptBlocker,
  acceptedKey,
  acceptProposal,
  glossaryEntryFor,
  readAcceptTargets,
  readProposal,
  rejectProposal,
  styleRuleBlockFor,
  type AcceptableProposal,
  type AcceptTargets,
} from './acceptProposal'

export {acceptProposalAction, proposalActions, rejectProposalAction} from './proposalActions'
