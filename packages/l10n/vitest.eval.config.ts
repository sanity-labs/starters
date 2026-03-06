import {defineConfig} from 'vitest/config'

// Load eval-specific overrides (API keys, auth tokens)
try {
  process.loadEnvFile(`${import.meta.dirname}/.env`)
} catch {}

export default defineConfig({
  envDir: '../..',
  test: {
    name: '@starter/l10n:eval',
    include: ['evals/*.eval.ts'],
    globalSetup: ['evals/setup.ts'],
    testTimeout: 120_000,
    bail: 1,
  },
})
