// document type names
export const localeTypeName = 'l10n.locale' as const
export const glossaryTypeName = 'l10n.glossary' as const
export const styleGuideTypeName = 'l10n.styleGuide' as const
/** What the learning loop proposes; a reviewer accepts it into the two above. */
export const proposalTypeName = 'l10n.proposal' as const
/** One per distilled run: the idempotency claim, and its own audit record. */
export const distillationTypeName = 'l10n.distillation' as const
// field names
export const languageFieldName = 'language' as const
// object type names
export const glossaryEntryTypeName = 'l10n.glossary.entry' as const
export const localeTranslationTypeName = 'l10n.glossary.entry.translation' as const
