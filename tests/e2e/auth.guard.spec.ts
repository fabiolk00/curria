import { expect, test } from '@playwright/test'

import { authenticateE2EUser, clearE2EAuth } from './fixtures/auth-session'
import { installCoreFunnelApiMocks } from './fixtures/api-mocks'

test.describe('protected dashboard access', () => {
  test('redirects guests to /login', async ({ page }) => {
    await clearE2EAuth(page)

    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  })

  test('allows E2E-authenticated users into protected routes', async ({ page }) => {
    await installCoreFunnelApiMocks(page)
    await authenticateE2EUser(page, {
      appUserId: 'usr_e2e_dashboard',
      displayName: 'Dashboard Test User',
      email: 'dashboard@example.com',
    })

    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/)
    await expect(page.getByPlaceholder(/descri.*vaga/i)).toBeVisible()
  })
})
