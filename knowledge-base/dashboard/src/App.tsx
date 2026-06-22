import {SanityApp, type SanityConfig} from '@sanity/sdk-react'

import {Dashboard} from './components/Dashboard'

const config: SanityConfig[] = [
  {
    projectId: process.env.SANITY_APP_PROJECT_ID,
    dataset: process.env.SANITY_APP_DATASET ?? 'production',
  },
]

export default function App() {
  return (
    <SanityApp config={config} fallback={<div style={{padding: 24}}>Loading…</div>}>
      <Dashboard />
    </SanityApp>
  )
}
