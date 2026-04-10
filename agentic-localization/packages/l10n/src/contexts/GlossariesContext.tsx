import {createContext, useContext, useMemo, type ReactNode} from 'react'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, useDocumentStore, usePerspective} from 'sanity'
import {useObservable} from 'react-rx'
import type {Glossary} from '../promptAssembly'
import {GLOSSARIES_QUERY} from '../queries'

const GlossariesContext = createContext<Glossary[] | undefined>(undefined)

export function GlossariesProvider({children}: {children: ReactNode}) {
  const documentStore = useDocumentStore()
  const {perspectiveStack} = usePerspective()

  const glossaries$ = useMemo(
    () =>
      documentStore.listenQuery(
        GLOSSARIES_QUERY,
        {},
        {
          ...DEFAULT_STUDIO_CLIENT_OPTIONS,
          perspective: perspectiveStack,
        },
      ),
    [documentStore, perspectiveStack],
  )

  const glossaries = useObservable(glossaries$) as Glossary[] | undefined

  return <GlossariesContext.Provider value={glossaries}>{children}</GlossariesContext.Provider>
}

export function useGlossariesContext(): Glossary[] | undefined {
  return useContext(GlossariesContext)
}
