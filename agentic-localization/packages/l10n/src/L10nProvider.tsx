/**
 * Global context providers for the l10n plugin.
 *
 * Mounts two realtime subscriptions at the Studio layout level:
 * 1. Locales — all `l10n.locale` documents (shared by navbar, inputs, inspectors)
 * 2. Glossaries — all `l10n.glossary` documents (shared by translation prompts)
 *
 * Every consumer reads from context instead of opening its own EventSource,
 * preventing reconnection storms when many components need the same data.
 */

import {createContext, use, useMemo, type ReactNode} from 'react'
import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  useDocumentStore,
  usePerspective,
  type LayoutProps,
} from 'sanity'
import {useObservable} from 'react-rx'
import type {Language} from 'sanity-plugin-internationalized-array'
import type {Glossary} from './promptAssembly'
import {GLOSSARIES_QUERY, SUPPORTED_LANGUAGES_QUERY} from './queries'
import {getFlagFromCode} from './utils'

export type {Language}

export interface Locale {
  id: string
  title: string
  flag: string
  fallbackLocale: string | undefined
}

// ---------------------------------------------------------------------------
// Locales
// ---------------------------------------------------------------------------

const LocalesContext = createContext<Locale[] | undefined>(undefined)

function LocalesProvider({children}: {children: ReactNode}) {
  const documentStore = useDocumentStore()
  const {perspectiveStack} = usePerspective()

  const languages$ = documentStore.listenQuery(
    SUPPORTED_LANGUAGES_QUERY,
    {},
    {
      ...DEFAULT_STUDIO_CLIENT_OPTIONS,
      perspective: perspectiveStack,
    },
  )

  const raw = useObservable(languages$) as
    | Array<{id: string; title: string; fallbackLocale: string | null}>
    | undefined

  const locales = useMemo(
    () =>
      raw?.map((l) => ({
        id: l.id,
        title: l.title,
        flag: getFlagFromCode(l.id),
        fallbackLocale: l.fallbackLocale ?? undefined,
      })),
    [raw],
  )

  return <LocalesContext value={locales}>{children}</LocalesContext>
}

export function useLocales(): Locale[] | undefined {
  return use(LocalesContext)
}

// ---------------------------------------------------------------------------
// Glossaries
// ---------------------------------------------------------------------------

const GlossariesContext = createContext<Glossary[] | undefined>(undefined)

function GlossariesProvider({children}: {children: ReactNode}) {
  const documentStore = useDocumentStore()
  const {perspectiveStack} = usePerspective()

  const glossaries$ = documentStore.listenQuery(
    GLOSSARIES_QUERY,
    {},
    {
      ...DEFAULT_STUDIO_CLIENT_OPTIONS,
      perspective: perspectiveStack,
    },
  )

  const glossaries = useObservable(glossaries$) as Glossary[] | undefined

  return <GlossariesContext value={glossaries}>{children}</GlossariesContext>
}

export function useGlossaries(): Glossary[] | undefined {
  return use(GlossariesContext)
}

// ---------------------------------------------------------------------------
// Composite layout provider (registered as studio.components.layout)
// ---------------------------------------------------------------------------

export function L10nProvider(props: LayoutProps) {
  return (
    <LocalesProvider>
      <GlossariesProvider>{props.renderDefault(props)}</GlossariesProvider>
    </LocalesProvider>
  )
}
