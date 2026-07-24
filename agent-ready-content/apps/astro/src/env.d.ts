/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SANITY_PROJECT_ID: string
  readonly SANITY_DATASET?: string
  readonly SITE_URL?: string
  readonly SITE_TITLE?: string
  readonly SITE_SUMMARY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
