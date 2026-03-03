import {defineCliConfig} from 'sanity/cli'

// Load root env for CLI config (Vite's envDir only affects browser builds)
try {
  process.loadEnvFile(`${__dirname}/../../.env`)
} catch {}

export default defineCliConfig({
  app: {
    entry: './src/App.tsx',
    organizationId: process.env.SANITY_STUDIO_ORGANIZATION_ID ?? '',
  },
  reactCompiler: {
    target: '19',
  },
  vite: {
    envDir: '../..',
    server: {
      port: 3334,
      open: process.env.SANITY_STUDIO_SERVER_OPEN === 'true',
    },
  },
})
