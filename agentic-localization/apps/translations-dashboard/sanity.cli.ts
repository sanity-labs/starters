import {defineCliConfig} from 'sanity/cli'

// Load root env for CLI config (Vite's envDir only affects browser builds)
try {
  process.loadEnvFile(`${__dirname}/../../.env`)
} catch {}

export default defineCliConfig({
  app: {
    entry: './src/App.tsx',
    organizationId: process.env.SANITY_STUDIO_ORGANIZATION_ID!,
  },
  reactCompiler: {
    target: '19',
  },
  vite: {
    define: {
      'import.meta.env.SANITY_APP_PROJECT_ID': JSON.stringify(process.env.SANITY_STUDIO_PROJECT_ID),
      'import.meta.env.SANITY_APP_DATASET': JSON.stringify(process.env.SANITY_STUDIO_DATASET),
      'import.meta.env.SANITY_APP_STUDIO_URL': JSON.stringify(process.env.SANITY_STUDIO_URL ?? ''),
    },
    server: {
      port: 3334,
      open: process.env.SANITY_STUDIO_SERVER_OPEN === 'true',
    },
  },
})
