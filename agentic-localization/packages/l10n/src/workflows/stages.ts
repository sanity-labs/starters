/**
 * The stage vocabulary of `localize-document`.
 *
 * `defineStage` widens `name` to `string`, so the definition declares its stages
 * against this tuple rather than the other way round — `localizeDocument.ts`
 * takes `LocalizeDocumentStage` as the name of every stage it declares, and a
 * rename that misses a call site does not compile.
 * `localizeDocument.contracts.test.ts` pins the tuple to the definition's stages
 * both ways, closing the direction the compiler cannot see: a name listed here
 * and declared nowhere.
 */
export const LOCALIZE_DOCUMENT_STAGES = [
  'analyzing',
  'translating',
  'review',
  'approved',
  'done',
  'failed',
] as const

export type LocalizeDocumentStage = (typeof LOCALIZE_DOCUMENT_STAGES)[number]

/**
 * The terminal stage of `localize-document` a reviewer's approval reaches.
 *
 * The `distill-review` blueprint filter is a string in a jiti-loaded config and
 * the learning loop's Function matches on it, so both sides read the one literal
 * declared here. `distillTrigger.test.ts` bench-proves it is a real terminal
 * stage.
 */
export const APPROVED_STAGE = 'approved' satisfies LocalizeDocumentStage

/**
 * `SubjectRun.stage` is whatever string the engine wrote — an instance started
 * under an earlier deployment carries that deployment's vocabulary — so the sets
 * the surfaces test it against stay keyed by `string`. Their contents are the
 * vocabulary, checked.
 */
function stageSet(...stages: LocalizeDocumentStage[]): ReadonlySet<string> {
  return new Set(stages)
}

/**
 * Stages where the engine is doing the work: the surfaces that bucket runs — the
 * Studio inbox, the dashboard grid — say so and wait.
 */
export const IN_PROGRESS_STAGES = stageSet('analyzing', 'translating')

/** Terminal-success stages, seen only before the instance settles out of a list. */
export const SETTLED_STAGES = stageSet(APPROVED_STAGE, 'done')
