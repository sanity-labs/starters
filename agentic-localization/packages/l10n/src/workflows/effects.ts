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
