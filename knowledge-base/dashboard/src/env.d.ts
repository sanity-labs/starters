// SANITY_APP_-prefixed vars are bundled into the browser by the App SDK build.
// Never put Sanity tokens here — the read token lives in the dashboard-server
// proxy. SANITY_APP_DASHBOARD_API_TOKEN is the one deliberate exception: a
// shared secret the proxy requires, visible to anyone who can load this app
// (staff signed in to Sanity), and worthless against the Content Lake itself.
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SANITY_APP_PROJECT_ID: string
      SANITY_APP_DATASET?: string
      SANITY_APP_CHAT_PROXY_URL: string
      SANITY_APP_DASHBOARD_API_TOKEN: string
    }
  }
}

export {}
