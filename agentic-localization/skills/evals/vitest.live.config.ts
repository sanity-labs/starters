import {defineConfig} from 'vitest/config'

/**
 * Live grading env, mirroring packages/l10n's eval config:
 *  - `envDir` picks up SANITY_STUDIO_PROJECT_ID / SANITY_STUDIO_DATASET from the repo root .env
 *  - packages/l10n/.env (gitignored) supplies SANITY_AUTH_TOKEN; `sanity login` is the fallback
 *  - GRADER_TRIALS overrides the routing draws per query (default 1)
 */
try {
  process.loadEnvFile(`${import.meta.dirname}/../../packages/l10n/.env`)
} catch {}

export default defineConfig({
  envDir: '../..',
  test: {
    name: '@starter/skill-evals:live',
    include: ['*.live.ts'],
    // Every case is a live Agent Action; running the files in parallel on top of
    // the per-file concurrency trips the API rate limit.
    fileParallelism: false,
    // The per-case pass rates are the point of the suite, not just the verdict.
    reporters: ['verbose'],
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
})
