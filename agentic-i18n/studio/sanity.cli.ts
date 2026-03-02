import {defineCliConfig} from 'sanity/cli'

// Load root env for CLI config (Vite's envDir only affects browser builds)
try {
  process.loadEnvFile(`${__dirname}/../.env.local`)
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
  vite: {
    envDir: '..',
    server: {
      open: process.env.SANITY_STUDIO_SERVER_OPEN === 'true',
    },
  },
  deployment: {
    autoUpdates: true,
  },
  typegen: {
    enabled: true,
    path: [
      './src/**/*.{ts,tsx}',
      '../packages/l10n/src/**/*.{ts,tsx}',
      '../apps/translations-dashboard/src/**/*.{ts,tsx}',
      '../functions/*.ts',
    ],
    generates: '../packages/@starter/sanity-types/sanity.types.ts',
  },
})
