import { expect, type Page } from '@playwright/test'

const e2ePort = process.env.E2E_PORT ?? '3000'
const DEFAULT_BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${e2ePort}`

type BootstrapOptions = {
  appUserId?: string
  creditsRemaining?: number
  displayName?: string
  email?: string
}

function getAuthSecret(): string {
  return process.env.E2E_AUTH_BYPASS_SECRET ?? 'curria-e2e-secret'
}

export async function authenticateE2EUser(
  page: Page,
  options: BootstrapOptions = {},
): Promise<void> {
  const response = await page.request.post('/api/e2e/auth', {
    data: options,
    headers: {
      origin: DEFAULT_BASE_URL,
      'x-e2e-auth-secret': getAuthSecret(),
    },
  })
  const body = await response.text()

  expect(response.ok(), body).toBeTruthy()
}

export async function clearE2EAuth(page: Page): Promise<void> {
  const response = await page.request.delete('/api/e2e/auth', {
    headers: {
      origin: DEFAULT_BASE_URL,
      'x-e2e-auth-secret': getAuthSecret(),
    },
  })

  expect(response.status()).toBe(204)
}
