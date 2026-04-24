import {defineCliConfig} from 'sanity/cli'

// Load studio .env so CLI commands (schema extract, typegen, etc.) have access
// to SANITY_STUDIO_* variables. Vite handles this automatically during `sanity dev`.
try {
  process.loadEnvFile(`${import.meta.dirname}/.env`)
} catch {}

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
    dataset: process.env.SANITY_STUDIO_DATASET!,
  },
  reactCompiler: {
    target: '19',
  },
  reactStrictMode: true,
  deployment: {
    autoUpdates: true,
    appId: 'dlww8cceqzdyu82vwzkfrpz9',
  },
  typegen: {
    enabled: true,
    path: [
      './schemaTypes/**/*.{ts,tsx}',
      '../frontend/app/**/*.{ts,tsx}',
      '../frontend/sanity/**/*.{ts,tsx}',
      '../functions/import-klaviyo/**/*.ts',
      '../functions/on-promotion-approved/**/*.ts',
    ],
    generates: '../packages/sanity-types/sanity.types.ts',
    overloadClientMethods: true,
  },
  schemaExtraction: {
    enabled: true,
  },
})
