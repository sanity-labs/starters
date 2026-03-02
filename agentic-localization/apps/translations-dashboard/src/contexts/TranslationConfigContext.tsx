import {
  resolveConfig,
  type ResolvedTranslationsConfig,
  type TranslationsConfig,
} from '@starter/l10n'
import {type SanityClient} from '@sanity/client'
import {type SanityConfig} from '@sanity/sdk'
import {useClient} from '@sanity/sdk-react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

export type LanguageData = {
  fallbackLocale?: null | string
  flag?: string
  id: string
  releaseId?: string
  status?: 'draft' | 'in_release' | 'published'
  title: string
}

export type TranslationConfigContextType = {
  defaultLanguage: null | string
  getLanguages: (client: SanityClient) => Promise<LanguageData[]>
  languages: LanguageData[]
  sanityClientConfig: {apiVersion: string; dataset: string; projectId: string; useCdn: boolean}
  setDefaultLanguage: (language: null | string) => void
  setLanguages: (languages: LanguageData[]) => void
  supportedTypes: string[]
  translationsConfig: ResolvedTranslationsConfig
}

const TranslationConfigContext = createContext<TranslationConfigContextType | undefined>(undefined)

export interface TranslationConfigProviderProps {
  children: ReactNode
  config: SanityConfigWithSupportedLanguages
  sanityConfig: SanityConfig
  translationsConfig: TranslationsConfig
}

interface SanityConfigWithSupportedLanguages extends SanityConfig {
  defaultLanguage: string
  schemaTypes: string[]
  supportedLanguages: (client: SanityClient) => LanguageData[] | Promise<LanguageData[]>
}

export function TranslationConfigProvider({
  children,
  config,
  sanityConfig: sanityProjectConfig,
  translationsConfig: rawTranslationsConfig,
}: TranslationConfigProviderProps) {
  const translationsConfig = useMemo(
    () => resolveConfig(rawTranslationsConfig),
    [rawTranslationsConfig],
  )

  const sanityClientConfig = useMemo(
    () => ({
      apiVersion: 'vX',
      dataset: sanityProjectConfig.dataset ?? 'production',
      projectId: sanityProjectConfig.projectId ?? '',
      useCdn: false,
    }),
    [sanityProjectConfig],
  )

  const client = useClient(sanityClientConfig)

  const getLanguages = useCallback(
    async (c: SanityClient): Promise<LanguageData[]> => {
      if (Array.isArray(config.supportedLanguages)) {
        return config.supportedLanguages
      }
      if (typeof config.supportedLanguages === 'function') {
        return await config.supportedLanguages(c)
      }
      const data = await c.fetch(config.supportedLanguages)
      return data
    },
    [config],
  )

  const [defaultLanguage, setDefaultLanguage] = useState<null | string>(
    config.defaultLanguage || null,
  )
  const [languages, setLanguagesInternal] = useState<LanguageData[]>([])
  const setLanguages = (newLanguages: LanguageData[]) => {
    setLanguagesInternal(newLanguages)
  }

  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const loadedLanguages = await getLanguages(client)
        setLanguages(loadedLanguages)
      } catch {}
    }
    loadLanguages()
  }, [client, getLanguages])

  const value: TranslationConfigContextType = useMemo(
    () => ({
      defaultLanguage,
      getLanguages,
      languages,
      sanityClientConfig,
      setDefaultLanguage,
      setLanguages,
      supportedTypes: config.schemaTypes,
      translationsConfig,
    }),
    [
      defaultLanguage,
      getLanguages,
      languages,
      sanityClientConfig,
      config.schemaTypes,
      translationsConfig,
    ],
  )

  return (
    <TranslationConfigContext.Provider value={value}>{children}</TranslationConfigContext.Provider>
  )
}

export function useTranslationConfig(): TranslationConfigContextType {
  const context = useContext(TranslationConfigContext)
  if (context === undefined) {
    throw new Error('useTranslationConfig must be used within a TranslationConfigProvider')
  }
  return context
}
