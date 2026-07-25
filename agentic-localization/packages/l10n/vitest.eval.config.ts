import {defineConfig} from 'vitest/config'

/**
 * Eval env:
 *  - `envDir` picks up SANITY_STUDIO_PROJECT_ID / SANITY_STUDIO_DATASET from the repo root .env
 *  - packages/l10n/.env (gitignored, see .env.example) supplies SANITY_AUTH_TOKEN, which the
 *    root .env deliberately does not carry. `sanity login` works as a fallback.
 *  - EVAL_SAMPLES overrides the translation draws per case (default 3).
 */
try {
  process.loadEnvFile(`${import.meta.dirname}/.env`)
} catch {}

export default defineConfig({
  envDir: '../..',
  test: {
    name: '@starter/l10n:eval',
    include: ['evals/*.eval.ts'],
    globalSetup: ['evals/setup.ts'],
    // Sampling multiplies live Agent Action calls, and running the case files in
    // parallel on top of that trips the API rate limit. One case at a time.
    fileParallelism: false,
    // The default reporter only surfaces console output for failing tests, and the
    // per-sample outcomes of a passing case are the point of the suite.
    reporters: ['verbose'],
    // Backstop only — each case sets its own timeout, scaled to EVAL_SAMPLES.
    testTimeout: 300_000,
    // No bail: every case should report its sample outcomes, since the point of
    // the suite is seeing how much variance the aggregation absorbed.
  },
})
