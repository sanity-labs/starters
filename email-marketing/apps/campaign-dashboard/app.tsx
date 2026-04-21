import {Suspense, useState} from 'react'
import {SanityApp} from '@sanity/sdk-react'
import {CampaignList} from './views/CampaignList'
import {CampaignDetail} from './views/CampaignDetail'

const config = {
  projectId: import.meta.env.SANITY_APP_PROJECT_ID as string,
  dataset: (import.meta.env.SANITY_APP_DATASET ?? 'production') as string,
  ...(import.meta.env.SANITY_APP_TOKEN
    ? {auth: {token: import.meta.env.SANITY_APP_TOKEN as string}}
    : {}),
}

type Route = {page: 'campaigns'} | {page: 'campaign'; id: string}

export function App() {
  const [route, setRoute] = useState<Route>({page: 'campaigns'})

  return (
    <SanityApp config={config} fallback={<Loading />}>
      <div
        style={{
          fontFamily: 'system-ui, sans-serif',
          maxWidth: 960,
          margin: '0 auto',
          padding: '2rem 1rem',
        }}
      >
        <Suspense fallback={<Loading />}>
          {route.page === 'campaigns' && (
            <CampaignList onSelect={(id) => setRoute({page: 'campaign', id})} />
          )}
          {route.page === 'campaign' && (
            <CampaignDetail campaignId={route.id} onBack={() => setRoute({page: 'campaigns'})} />
          )}
        </Suspense>
      </div>
    </SanityApp>
  )
}

function Loading() {
  return <div style={{padding: '2rem', color: '#666', fontSize: 14}}>Loading…</div>
}
