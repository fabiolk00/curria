import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'line',
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
  webServer: {
    command: 'node scripts/start-e2e-dev-server.mjs',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
