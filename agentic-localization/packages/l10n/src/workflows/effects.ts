/**
 * Effect names shared by the workflow definitions and the runtime handlers that
 * satisfy them. The engine matches a queued effect to a handler by name alone,
 * so a typo on either side surfaces only at drain time — keep both sides here.
 */
export const ANALYZE_SOURCE = 'analyze-source'
export const TRANSLATE_LOCALE = 'translate-locale'
export const PUBLISH_RELEASE = 'publish-release'

export const EFFECT_NAMES = [ANALYZE_SOURCE, TRANSLATE_LOCALE, PUBLISH_RELEASE] as const

export type EffectName = (typeof EFFECT_NAMES)[number]

/**
 * The terminal stage of `localize-document` a reviewer's approval reaches.
 *
 * Here for the same reason the effect names are: the `distill-review` blueprint
 * filter is a string in a jiti-loaded config and the learning loop's Function
 * matches on it, so both sides read the one literal the definition declares.
 * `distillTrigger.test.ts` bench-proves it is a real terminal stage.
 */
export const APPROVED_STAGE = 'approved'

/**
 * Stages where the engine is doing the work.
 *
 * `SubjectRun.stage` is whatever string the engine wrote, so the surfaces that
 * bucket runs — the Studio inbox, the dashboard grid — name stages to compare
 * against. Beside the definition, for the same reason `APPROVED_STAGE` is, and
 * `localizeDocument.contracts.test.ts` bench-proves both sets against it.
 */
export const IN_PROGRESS_STAGES: ReadonlySet<string> = new Set(['analyzing', 'translating'])

/** Terminal-success stages, seen only before the instance settles out of a list. */
export const SETTLED_STAGES: ReadonlySet<string> = new Set([APPROVED_STAGE, 'done'])
