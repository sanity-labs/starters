// document type names
export const localeTypeName = 'l10n.locale' as const
export const glossaryTypeName = 'l10n.glossary' as const
export const styleGuideTypeName = 'l10n.styleGuide' as const
/** What the learning loop proposes; a reviewer accepts it into the two above. */
export const proposalTypeName = 'l10n.proposal' as const
/** One per distilled run: the idempotency claim, and its own audit record. */
export const distillationTypeName = 'l10n.distillation' as const
// field names
/**
 * Not the plugins' `LANGUAGE_FIELD_NAME`: neither
 * `sanity-plugin-internationalized-array` nor `@sanity/document-internationalization`
 * exports it, and both are Studio-only, which the node floor's lint zone bans.
 * `internationalizedArrayContract.test.ts` pins the name against their declarations.
 */
export const languageFieldName = 'language' as const
// object type names
export const glossaryEntryTypeName = 'l10n.glossary.entry' as const
export const localeTranslationTypeName = 'l10n.glossary.entry.translation' as const
