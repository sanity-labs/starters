/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean
  readonly SANITY_APP_DATASET: string
  readonly SANITY_APP_PROJECT_ID: string
  readonly SANITY_APP_STUDIO_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
