interface ImportMetaEnv {
  readonly SANITY_STUDIO_PROJECT_ID: string
  readonly SANITY_STUDIO_DATASET: string
  readonly SANITY_STUDIO_ORGANIZATION_ID?: string
  readonly SANITY_STUDIO_SERVER_OPEN?: string
}

interface ImportMeta {
  readonly env?: ImportMetaEnv
}
