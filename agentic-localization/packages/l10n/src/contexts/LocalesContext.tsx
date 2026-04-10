import {createContext, useContext, useMemo, type ReactNode} from 'react'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, useDocumentStore, usePerspective} from 'sanity'
import {useObservable} from 'react-rx'
import type {Language} from 'sanity-plugin-internationalized-array'
import {SUPPORTED_LANGUAGES_QUERY} from '../queries'

const LocalesContext = createContext<Language[] | undefined>(undefined)

export function LocalesProvider({children}: {children: ReactNode}) {
  const documentStore = useDocumentStore()
  const {perspectiveStack} = usePerspective()

  const languages$ = useMemo(
    () =>
      documentStore.listenQuery(
        SUPPORTED_LANGUAGES_QUERY,
        {},
        {
          ...DEFAULT_STUDIO_CLIENT_OPTIONS,
          perspective: perspectiveStack,
        },
      ),
    [documentStore, perspectiveStack],
  )

  const languages = useObservable(languages$) as Language[] | undefined

  return <LocalesContext.Provider value={languages}>{children}</LocalesContext.Provider>
}

export function useLocalesContext(): Language[] | undefined {
  return useContext(LocalesContext)
}
