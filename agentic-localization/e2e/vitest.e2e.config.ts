import {defineConfig} from 'vitest/config'

/**
 * The end-to-end suite. Real project, real datasets, real engine — so it is a
 * separate config from every `vitest.config.ts` in the repo and never runs
 * under `pnpm -r test`.
 *
 * Two projects, because the two layers have different preconditions and very
 * different runtimes: `api` needs the e2e dataset pair and takes ~22 minutes,
 * `browser` needs the dev servers and takes ~1. `--project <name>` runs one.
 *
 * Credentials:
 *  - `envDir` picks up SANITY_STUDIO_PROJECT_ID from the starter root `.env`
 *  - `e2e/.env` (gitignored) may supply SANITY_AUTH_TOKEN and the dataset
 *    overrides; a local `sanity login` session is the token fallback
 */
// `envDir` reaches the test workers but not `globalSetup`, which runs in the
// main process — so the files are loaded here as well.
for (const file of [`${import.meta.dirname}/../.env`, `${import.meta.dirname}/.env`]) {
  try {
    process.loadEnvFile(file)
  } catch {}
}

export default defineConfig({
  envDir: '..',
  test: {
    // One journey at a time. Every file drives the same project, and a run's
    // own effect dispatches are the only concurrency the suite wants.
    fileParallelism: false,
    // The Content Lake, the engine and (in mode H) three chained handler
    // dispatches per locale. A journey is seconds, not milliseconds.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Scenario names are the deliverable — a silent pass hides which journeys ran.
    reporters: ['verbose'],
    projects: [
      {
        extends: true,
        test: {
          name: 'api',
          include: ['features/**/*.e2e.ts'],
          globalSetup: ['fixtures/globalSetup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['browser/**/*.e2e.ts'],
          globalSetup: ['browser/globalSetup.ts'],
        },
      },
    ],
  },
})
