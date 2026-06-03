// SANITY_APP_-prefixed vars are bundled into the browser by the App SDK build.
// Never put secrets here — the chat token lives in the dashboard-server proxy.
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SANITY_APP_PROJECT_ID: string
      SANITY_APP_DATASET?: string
      SANITY_APP_CHAT_PROXY_URL: string
    }
  }
}

export {}
