/**
 * AppContext — composition root for the three focused contexts.
 *
 * All consumers should migrate to the specific hooks:
 *   - `useTranslationConfig()` for config, languages, sanityClientConfig
 *   - `useSelection()` for selected documents, types, batch mode, status
 *   - `useTranslationProgress()` for translation progress, creation status, batch status
 *
 * `useApp()` is kept as a compatibility shim that composes all three.
 */

import {type TranslationsConfig} from '@starter/l10n'
import {type SanityClient} from '@sanity/client'
import {type SanityConfig} from '@sanity/sdk'
import {type ReactNode} from 'react'

import {SelectionProvider, useSelection} from './SelectionContext'
import {
  type LanguageData,
  TranslationConfigProvider,
  useTranslationConfig,
} from './TranslationConfigContext'
import {TranslationProgressProvider, useTranslationProgress} from './TranslationProgressContext'

// Re-export LanguageData so existing imports from AppContext still work
export type {LanguageData} from './TranslationConfigContext'

interface AppContextProviderProps {
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

export function AppContextProvider({
  children,
  config,
  sanityConfig,
  translationsConfig,
}: AppContextProviderProps) {
  return (
    <TranslationConfigProvider
      config={config}
      sanityConfig={sanityConfig}
      translationsConfig={translationsConfig}
    >
      <SelectionProvider initialDocumentType={config.schemaTypes[0] || 'article'}>
        <TranslationProgressProvider>{children}</TranslationProgressProvider>
      </SelectionProvider>
    </TranslationConfigProvider>
  )
}

/**
 * Compatibility shim — composes all three focused context hooks.
 * Prefer using the specific hooks directly in new code.
 */
export function useApp() {
  const config = useTranslationConfig()
  const selection = useSelection()
  const progress = useTranslationProgress()

  return {
    ...config,
    ...selection,
    ...progress,
  }
}
