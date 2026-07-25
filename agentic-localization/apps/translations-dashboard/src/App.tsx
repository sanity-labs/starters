import './App.css'

import type {TranslationsConfig} from '@starter/l10n'

import {createClient} from '@sanity/client'
import {type SanityConfig} from '@sanity/sdk'
import {SanityApp} from '@sanity/sdk-react'
import {WorkflowTelemetryProvider} from '@sanity/workflow-sdk'
import {SOURCE_LANGUAGE} from '@starter/l10n/workflows'
import {BrowserRouter, Route, Routes} from 'react-router-dom'
import type {SanityClient} from 'sanity'

import DashboardSkeleton from './components/DashboardSkeleton'
import ErrorBoundary from './components/ErrorBoundary'
import {DOCUMENT_INTERNATIONALIZATION_TYPES} from './consts/documentInternationalization'
import {CONTENT_DATASET, PROJECT_ID} from './consts/workflows'
import {TranslationConfigProvider} from './contexts/TranslationConfigContext'
import {getLocales} from './helpers/getLocales'
import DashboardRoute from './routes/DashboardRoute'
import RunRoute from './routes/RunRoute'
import TranslationsRoute from './routes/TranslationsRoute'
import SanityUI from './SanityUI'

const SANITY_CONFIG: SanityConfig = {
  dataset: CONTENT_DATASET,
  projectId: PROJECT_ID,
  auth: {
    clientFactory: (config) =>
      createClient({...config, requestTagPrefix: `${config.requestTagPrefix}.agentic-l10n`}),
  },
}

/**
 * Which document types are translatable, what the base language is, and which
 * field carries the language. The one source of truth for the app.
 */
const TRANSLATIONS_CONFIG: TranslationsConfig = {
  defaultLanguage: SOURCE_LANGUAGE,
  internationalizedTypes: DOCUMENT_INTERNATIONALIZATION_TYPES,
  languageField: 'language',
}

function App() {
  const appConfig = {
    defaultLanguage: SOURCE_LANGUAGE,
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
            <WorkflowTelemetryProvider>
              <TranslationConfigProvider
                config={appConfig}
                translationsConfig={TRANSLATIONS_CONFIG}
              >
                <ErrorBoundary featureName="Translations Dashboard">
                  <BrowserRouter>
                    <Routes>
                      <Route element={<DashboardRoute />} path="/" />
                      <Route element={<TranslationsRoute />} path="/translations" />
                      <Route element={<RunRoute />} path="/runs/:instanceId" />
                    </Routes>
                  </BrowserRouter>
                </ErrorBoundary>
              </TranslationConfigProvider>
            </WorkflowTelemetryProvider>
          </SanityApp>
        </SanityUI>
      </div>
    </div>
  )
}

export default App
