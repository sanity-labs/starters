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
  },
  typegen: {
    enabled: true,
    path: [
      './schemaTypes/**/*.{ts,tsx}',
      './components/**/*.{ts,tsx}',
      './structure.ts',
      '../frontend/app/**/*.{ts,tsx}',
      '../frontend/sanity/**/*.{ts,tsx}',
      '../frontend/lib/**/*.{ts,tsx}',
      '../functions/{collection-sync,badge-resync}/*.ts',
      '../packages/@starter/commerce/src/**/*.ts',
    ],
    generates: '../packages/@starter/sanity-types/sanity.types.ts',
    overloadClientMethods: true,
  },
})
