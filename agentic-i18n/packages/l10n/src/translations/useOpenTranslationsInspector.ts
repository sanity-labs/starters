import {useCallback} from 'react'
import {useDocumentPane} from 'sanity/structure'

const INSPECTOR_NAME = 'translations'

/**
 * Opens the Translations inspector panel from any component
 * rendered inside a document pane.
 *
 * @example
 * ```tsx
 * import {useOpenTranslationsInspector} from '@starter/l10n'
 *
 * function MyComponent() {
 *   const openTranslations = useOpenTranslationsInspector()
 *   return <button onClick={openTranslations}>Translate</button>
 * }
 * ```
 */
export function useOpenTranslationsInspector(): () => void {
  const {openInspector} = useDocumentPane()
  return useCallback(() => openInspector(INSPECTOR_NAME), [openInspector])
}
