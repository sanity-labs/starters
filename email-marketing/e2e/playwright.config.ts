import {defineConfig, devices} from '@playwright/test'

const STUDIO_URL = process.env.STUDIO_URL ?? 'http://localhost:3333'
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'
const PROJECT_ID = process.env.SANITY_STUDIO_PROJECT_ID
const TOKEN = process.env.SANITY_E2E_SESSION_TOKEN

if (!PROJECT_ID || !TOKEN) {
  throw new Error(
    'SANITY_STUDIO_PROJECT_ID and SANITY_E2E_SESSION_TOKEN must be set to run e2e tests',
  )
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', {open: 'never'}]] : 'html',
  use: {
    baseURL: STUDIO_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: STUDIO_URL,
          localStorage: [
            {
              name: `__studio_auth_token_${PROJECT_ID}`,
              value: JSON.stringify({token: TOKEN, time: new Date().toISOString()}),
            },
          ],
        },
      ],
    },
  },
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome']}}],
  webServer: [
    {
      command: 'pnpm --filter studio dev',
      url: STUDIO_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter frontend dev',
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
