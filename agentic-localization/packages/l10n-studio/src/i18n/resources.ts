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

  // --- Inline diff ---
  'diff.sr-summary': '{{removed}} word(s) removed, {{added}} word(s) added',
  'diff.show-full': '… [show full diff]',
  'diff.block-added': 'added',
  'diff.block-moved': 'moved',
  'diff.block-removed': 'removed',
  'diff.no-changes': 'No text content changes detected',
  'diff.more-changes': '+ {{count}} more block change(s)',

  // --- Translation inspector (both tiers) ---
  'translations.title': 'Translations',
  'translations.no-locales': 'No target locales configured.',
  'translations.not-configured': '"{{documentType}}" is not configured for internationalization.',
  'translations.no-language':
    'This document does not have a language set. Set a language in the document form to manage translations.',
  'translations.no-base-document':
    'Could not find the base language document for this translation.',
  'translations.view-metadata': 'View metadata document',
  'translations.review-on-source':
    'The {{language}} translation. Review and approval happen on the source document.',
  'translations.open-source': 'Open source document',

  // --- Review matrix: the locale × field grid ---
  'matrix.identity': '{{stage}} · {{title}}',
  'matrix.column.locale': 'Locale',
  'matrix.state.same': 'Unchanged',
  'matrix.state.minor': 'Minor',
  'matrix.state.updated': 'Updated',
  'matrix.state.rewritten': 'Rewritten',
  'matrix.state.missing': 'Missing',
  'matrix.state.failed': 'Failed',
  'matrix.cell.label': '{{locale}}, {{field}}: {{state}}',
  'matrix.row.select': 'Show what changed in {{locale}}',
  'matrix.row.open': 'Open {{locale}}',
  'matrix.row.retry': 'Ask for {{locale}} again',
  'matrix.row.failed': 'Translation failed',
  'matrix.row.missing': 'Not translated',
  'matrix.row.changed_one': '{{count}} field changed',
  'matrix.row.changed_other': '{{count}} fields changed',
  'matrix.presentation.label': 'Show as',
  'matrix.presentation.grid': 'Grid',
  'matrix.presentation.rows': 'Rows',

  // --- Review matrix: the detail pane ---
  'matrix.detail.open-doc': 'Open doc',
  'matrix.detail.edit': 'Edit {{field}}',
  'matrix.detail.viewed': 'Mark as viewed',
  'matrix.detail.show-diff': 'Show diff ({{sign}}{{count}} chars)',
  'matrix.detail.none': 'Nothing differs from the published translation.',
  'matrix.detail.failed': 'This locale failed to translate. Ask for it again, or ship without it.',
  'matrix.detail.missing': 'No translation exists for this locale yet.',
  'matrix.magnitude.rewritten': 'rewritten',
  'matrix.magnitude.removed': 'removed',
  'matrix.magnitude.added': 'added',
  'matrix.magnitude.updated': 'updated',
  'matrix.magnitude.minor': 'minor',
  'matrix.magnitude.unchanged': 'unchanged',

  // --- Review matrix: the run and its footer ---
  'matrix.stage.analyzing': 'Analyzing',
  'matrix.stage.translating': 'Translating',
  'matrix.stage.review': 'Review',
  'matrix.stage.approved': 'Approved',
  'matrix.stage.done': 'Done',
  'matrix.stage.failed': 'Failed',
  'matrix.run.checking': 'Checking…',
  'matrix.run.loading': 'Loading…',
  'matrix.run.none': 'No run',
  'matrix.run.unreachable': 'Engine unreachable',
  'matrix.run.unreadable': 'Run unreadable',
  'matrix.run.model-ahead':
    'The run was written by a newer engine than this Studio. Upgrade the @sanity/workflow-* packages.',
  'matrix.run.malformed': 'The instance document does not match the shape the engine expects.',
  'matrix.materiality.cosmetic': 'Cosmetic',
  'matrix.materiality.minor': 'Minor impact',
  'matrix.materiality.material': 'Material impact',
  'matrix.materiality.explain': 'Why the machine said so',
  'matrix.flag.source-changed':
    'Source changed since analysis — the translations no longer match the English they came from.',
  'matrix.flag.drift-unreliable':
    'The source revision moved while this run was open, but this run reads drafts, so its own translations moved it too. Check the source yourself.',
  'matrix.flag.failed-locales_one': '{{count}} locale failed to translate.',
  'matrix.flag.failed-locales_other': '{{count}} locales failed to translate.',

  // --- Review verbs ---
  'review.request-changes.title': 'Request changes',
  'review.request-changes.cancel': 'Cancel',
  'review.request-changes.submit_one': 'Redo {{count}} locale',
  'review.request-changes.submit_other': 'Redo {{count}} locales',
  'review.request-changes.note-label': 'What should change?',
  'review.request-changes.note-placeholder':
    'The note is passed to the translator for every locale you pick.',
  'review.request-changes.locales-label': 'Locales to redo',
  'review.refresh-cost':
    'Re-analyzing spends another analysis call. Requesting changes reuses the analysis you already have.',

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
