import type {LocaleResourceRecord} from 'sanity'

export default {
  // --- Locale filter (navbar) ---
  'locale-filter.loading': 'Locale filter: loading',
  'locale-filter.button-label.all': 'All ({{total}})',
  'locale-filter.button-label.filtered': '{{count}} of {{total}}',
  'locale-filter.aria-label.all': 'Locale filter: all {{total}} locales',
  'locale-filter.aria-label.filtered': 'Locale filter: {{count}} of {{total}} locales selected',
  'locale-filter.show-all': 'Show all locales',
  'locale-filter.only': 'Only',
  'locale-filter.only-aria-label': 'Show only {{title}}',

  // --- Language input ---
  'language-input.loading': 'Loading locales…',
  'language-input.placeholder': 'Select a locale…',

  // --- Common / shared ---
  close: 'Close',
  'close-inspector': 'Close inspector',
  retry: 'Retry',
  'error.generic': 'Something went wrong',
  'error.with-feature': '{{featureName}} encountered an error',

  // --- Status display (used across surfaces) ---
  'status.missing.label': 'Missing',
  'status.missing.tooltip': 'No translation exists for this locale',
  'status.fallback.label': 'Fallback',
  'status.fallback.tooltip': 'No direct translation, but covered by a fallback locale',
  'status.needs-review.label': 'Review',
  'status.needs-review.tooltip': 'AI translation created, pending review',
  'status.approved.label': 'Approved',
  'status.approved.tooltip': 'Translation reviewed and approved',
  'status.stale.label': 'Stale',
  'status.stale.tooltip': 'Source document has changed since this translation was created',
  'status.translating.label': 'Translating…',
  'status.translating.tooltip': 'AI translation is in progress',
  'status.failed.label': 'Failed',
  'status.failed.tooltip': 'Translation failed — retry available',

  // --- Inspector toolbar button ---
  'inspector.title': 'Translations',
  'inspector.title.stale': 'Translations need attention — source content has changed',
  'inspector.title.needs-review': 'Translations pending review',

  // --- Publish / schedule gate ---
  'publish-gate.pending-review': '{{count}} translation(s) pending review',
  'publish-gate.stale': '{{count}} stale translation(s)',

  // --- Stale diff popover ---
  'stale-diff.title': 'Source content changed',
  'stale-diff.description':
    'The source text for {{fieldPath}} has changed since this translation was created.',
  'stale-diff.fallback': 'Source value was modified',
  'stale-diff.dismiss': 'Dismiss',
  'stale-diff.retranslate': 'Re-translate',

  // --- Inline diff ---
  'diff.sr-summary': '{{removed}} word(s) removed, {{added}} word(s) added',
  'diff.show-full': '… [show full diff]',
  'diff.block-added': 'added',
  'diff.block-removed': 'removed',
  'diff.no-changes': 'No text content changes detected',
  'diff.more-changes': '+ {{count}} more block change(s)',

  // --- Field translation inspector ---
  'field-translations.title': 'Field Translations',
  'field-translations.no-fields': 'No translatable fields found in this document type.',
  'field-translations.no-locales': 'No locales configured. Add locale documents to get started.',
  'field-translations.progress': '{{approved}} of {{total}} approved',
  'field-translations.badge.approved': '{{count}} approved',
  'field-translations.badge.review': '{{count}} review',
  'field-translations.badge.stale': '{{count}} stale',
  'field-translations.badge.missing': '{{count}} missing',
  'field-translations.header.field': 'Field',
  'field-translations.cell.translating': 'Translating…',
  'field-translations.cell.failed': 'Translation failed',
  'field-translations.cell.source': 'Source language',
  'field-translations.cell.click-approve': '{{tooltip}} — click to approve',
  'field-translations.cell.click-review': '{{tooltip}} — click to review',
  'field-translations.cell.click-translate': 'Click to translate',
  'field-translations.cell.translate-field': 'Translate all empty for this field',
  'field-translations.action.translate-missing': 'Translate {{count}} missing',
  'field-translations.action.approve': 'Approve {{count}} translations',
  'field-translations.legend.approved': 'approved',
  'field-translations.legend.review': 'review',
  'field-translations.legend.stale': 'stale',
  'field-translations.legend.missing': 'missing',

  // --- Document-level translation inspector ---
  'translations.title': 'Translations',
  'translations.progress': '{{completed}} of {{total}} translated',
  'translations.select-all': 'Click to select all {{label}}',
  'translations.doc-state.published': 'Published',
  'translations.doc-state.in-release': 'In release',
  'translations.doc-state.draft': 'Draft',
  'translations.doc-state.missing': 'Missing',
  'translations.go-to': 'Go to translation',
  'translations.go-to-fallback': 'Go to fallback document ({{locale}})',
  'translations.status.missing': 'Missing',
  'translations.status.working': 'Working',
  'translations.no-locales': 'No target locales configured.',
  'translations.header.language': 'Language',
  'translations.header.status': 'Status',
  'translations.not-configured': '"{{documentType}}" is not configured for internationalization.',
  'translations.no-language':
    'This document does not have a language set. Set a language in the document form to manage translations.',
  'translations.no-base-document':
    'Could not find the base language document for this translation.',
  'translations.working-in-release': 'Working in: {{releaseName}}',
  'translations.view-metadata': 'View metadata document',

  // --- Translated document task card ---
  'task-card.review-required': 'Review Required',
  'task-card.translation-approved': 'Translation Approved',
  'task-card.translation-stale': 'Translation Stale',
  'task-card.no-translation': 'No Translation',
  'task-card.time-ago': '{{prefix}} {{relative}} ago',
  'task-card.source-ai': 'AI translation',
  'task-card.source-manual': 'Manual translation',
  'task-card.review-description':
    'This translation needs review before it can be approved. Compare with the source document to verify accuracy and tone.',
  'task-card.open-source': 'Open Source Document',
  'task-card.approve': 'Approve Translation',
  'task-card.approve-description':
    'Marks this translation as approved across all perspectives and releases.',
  'task-card.approved-by': 'Approved by {{name}}',
  'task-card.no-translation-description': 'No translation exists for this language yet.',
  'task-card.generate': 'Generate Translation',
  'task-card.generate-to-release': 'Generate Translation → {{releaseName}}',

  // --- Stale AI analysis ---
  'stale-analysis.translation-updated': 'Translation updated',
  'stale-analysis.kept-current': 'Kept current',
  'stale-analysis.skipped': 'Skipped',
  'stale-analysis.pending': 'Pending',
  'stale-analysis.recommend-update': 'Update translation',
  'stale-analysis.recommend-keep': 'Keep current translation',
  'stale-analysis.recommendation': 'Recommendation: {{recommendation}}',
  'stale-analysis.reason': 'Reason',
  'stale-analysis.show-diff': 'Show word-level changes',
  'stale-analysis.hide-diff': 'Hide word-level changes',
  'stale-analysis.no-suggestion': 'Suggested translation not yet available',
  'stale-analysis.apply': 'Apply suggested update',
  'stale-analysis.keep': 'Keep current translation',
  'stale-analysis.skip': 'Skip',
  'stale-analysis.analyzing': 'Analyzing changes…',
  'stale-analysis.error': 'Unable to analyze changes.',
  'stale-analysis.error-fallback': 'You can still review changes manually in the Raw Diff tab.',
  'stale-analysis.updated-count': '{{count}} translation(s) updated',
  'stale-analysis.kept-count': '{{count}} kept as-is',
  'stale-analysis.skipped-count': '{{count}} skipped',
  'stale-analysis.mark-reviewed': 'Mark as Reviewed',
  'stale-analysis.apply-all': 'Apply all recommendations',
  'stale-analysis.summary': 'Summary',
  'stale-analysis.fields-to-review': 'Fields to review',
  'stale-analysis.excluded': '{{count}} suggestion(s) excluded (referenced an unrecognized field)',
} satisfies LocaleResourceRecord
