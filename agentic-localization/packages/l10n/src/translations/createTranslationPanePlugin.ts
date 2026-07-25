import {TranslateIcon} from '@sanity/icons'
import {defineDocumentInspector, type DocumentInspector, useTranslation} from 'sanity'

import {isFieldTier} from '../core/fieldTier'
import {resolveConfig, type TranslationsConfig} from '../core/types'
import {l10nLocaleNamespace} from '../i18n'
import {readFlag} from './instanceFields'
import {createTranslationInspectorComponent} from './TranslationInspector'
import {useLocalizationInstance} from './workflowEngine'

/**
 * Create a document inspector for the Translations panel.
 *
 * Registers a "Translations" button in the document toolbar that opens
 * an inspector panel showing per-locale translation status and actions.
 * The button is hidden for document types that are not internationalized.
 *
 * @example
 * ```ts
 * import {createTranslationInspector} from '@starter/l10n'
 *
 * const translationInspector = createTranslationInspector({
 *   internationalizedTypes: ['article', 'product'],
 *   defaultLanguage: 'en-US',
 * })
 *
 * export default defineConfig({
 *   document: {
 *     inspectors: (prev) => [translationInspector, ...prev],
 *   },
 * })
 * ```
 */
export function createTranslationInspector(config: TranslationsConfig): DocumentInspector {
  const resolved = resolveConfig(config)
  const InspectorComponent = createTranslationInspectorComponent(resolved)

  return defineDocumentInspector({
    name: 'translations',
    component: InspectorComponent,
    useMenuItem({documentId, documentType}) {
      const {t} = useTranslation(l10nLocaleNamespace)
      const hidden =
        !resolved.internationalizedTypes.includes(documentType) && !isFieldTier(documentType)
      const run = useRunBadge(documentId)

      return {
        icon: TranslateIcon,
        showAsAction: true,
        title: run.needsAttention
          ? t('inspector.title.stale')
          : run.inReview
            ? t('inspector.title.needs-review')
            : t('inspector.title'),
        tone: run.needsAttention ? 'suggest' : run.inReview ? 'caution' : undefined,
        hidden,
      }
    },
  })
}

// --- Internal hooks ---

/**
 * The badge, read off the open run's instance rather than off content — the
 * same source for both tiers, because both run the same definition. The two
 * advisory flags mean "a person should look"; the `review` stage means one is
 * expected to.
 */
function useRunBadge(documentId: string): {inReview: boolean; needsAttention: boolean} {
  const {instance} = useLocalizationInstance(documentId)
  if (!instance) return {inReview: false, needsAttention: false}
  return {
    inReview: instance.currentStage === 'review',
    needsAttention:
      readFlag(instance.fields, 'sourceChanged') || readFlag(instance.fields, 'hasFailedLocales'),
  }
}
