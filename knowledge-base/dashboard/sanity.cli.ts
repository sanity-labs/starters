import {defineCliConfig} from 'sanity/cli'

// Load .env so `sanity deploy` can read the organization ID.
try {
  process.loadEnvFile(`${import.meta.dirname}/.env`)
} catch {}

export default defineCliConfig({
  app: {
    organizationId: process.env.SANITY_STUDIO_ORGANIZATION_ID ?? '',
    entry: './src/App.tsx',
  },
})
