import {useCallback} from 'react'
import {useObservable} from 'react-rx'
import {globalLocaleFilter$} from './localeFilterState'

/**
 * React hook to read and update the global locale filter.
 *
 * An empty array means "show all locales" (no filter active).
 * The selection is persisted to localStorage and synced across tabs.
 *
 * @example
 * ```tsx
 * import {useLocaleFilter} from '@starter/l10n'
 *
 * function MyComponent() {
 *   const [selectedLocales, setLocaleFilter] = useLocaleFilter()
 *   return (
 *     <button onClick={() => setLocaleFilter(['en-US', 'fr-FR'])}>
 *       Filter to EN + FR
 *     </button>
 *   )
 * }
 * ```
 */
export function useLocaleFilter(): [
  selectedLocales: string[],
  setLocaleFilter: (locales: string[]) => void,
] {
  const selectedLocales = useObservable(globalLocaleFilter$, [])
  const setLocaleFilter = useCallback((locales: string[]) => {
    globalLocaleFilter$.next(locales)
  }, [])
  return [selectedLocales, setLocaleFilter]
}
