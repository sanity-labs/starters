import './App.css'

import type {TranslationsConfig} from '@starter/l10n'

import {createClient} from '@sanity/client'
import {type SanityConfig} from '@sanity/sdk'
import {SanityApp} from '@sanity/sdk-react'
import {BrowserRouter, Route, Routes} from 'react-router-dom'
import type {SanityClient} from 'sanity'

import DashboardSkeleton from './components/DashboardSkeleton'
import ErrorBoundary from './components/ErrorBoundary'
import {DOCUMENT_INTERNATIONALIZATION_TYPES} from './consts/documentInternationalization'
import {AppContextProvider} from './contexts/AppContext'
import {getLocales} from './helpers/getLocales'
import DashboardRoute from './routes/DashboardRoute'
import TranslationsRoute from './routes/TranslationsRoute'
import SanityUI from './SanityUI'

const SANITY_CONFIG: SanityConfig = {
  dataset: import.meta.env.SANITY_APP_DATASET || 'production',
  projectId: import.meta.env.SANITY_APP_PROJECT_ID,
  auth: {
    clientFactory: (config) =>
      createClient({
        ...config,
        requestTagPrefix: `${config.requestTagPrefix}.agentic-localization`,
      }),
  },
}

/**
 * Translations configuration using the shared TranslationsConfig type.
 * This is the single source of truth for what document types are translatable,
 * what the base language is, and what field stores the language.
 */
const TRANSLATIONS_CONFIG: TranslationsConfig = {
  defaultLanguage: 'en-US',
  internationalizedTypes: DOCUMENT_INTERNATIONALIZATION_TYPES,
  languageField: 'language',
}

function App() {
  const appConfig = {
    defaultLanguage: TRANSLATIONS_CONFIG.defaultLanguage ?? 'en-US',
    schemaTypes: [...TRANSLATIONS_CONFIG.internationalizedTypes],
    supportedLanguages: async (client: SanityClient) => {
      return await getLocales(client)
    },
  }

  return (
    <div className="app-container min-h-dvh h-full flex justify-center pt-18">
      <title>Translations Dashboard</title>
      <div className="w-[900px]">
        <SanityUI>
          <SanityApp config={SANITY_CONFIG} fallback={<DashboardSkeleton />}>
            <AppContextProvider config={appConfig} translationsConfig={TRANSLATIONS_CONFIG}>
              <ErrorBoundary featureName="Translations Dashboard">
                <BrowserRouter>
                  <Routes>
                    <Route element={<DashboardRoute />} path="/" />
                    <Route element={<TranslationsRoute />} path="/translations" />
                  </Routes>
                </BrowserRouter>
              </ErrorBoundary>
            </AppContextProvider>
          </SanityApp>
        </SanityUI>
      </div>
    </div>
  )
}

export default App
