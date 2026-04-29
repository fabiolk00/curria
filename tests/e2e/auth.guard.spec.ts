import { expect, test } from '@playwright/test'

import { authenticateE2EUser, clearE2EAuth } from './fixtures/auth-session'
import { installCoreFunnelApiMocks } from './fixtures/api-mocks'

test.describe('protected dashboard access', () => {
  test('redirects guests to the login route', async ({ page }) => {
    await clearE2EAuth(page)

    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/(entrar|login)(?:\?.*)?$/)
  })

  test('redirects authenticated users from retired chat to profile setup', async ({ page }) => {
    await installCoreFunnelApiMocks(page)
    await authenticateE2EUser(page, {
      appUserId: 'usr_e2e_dashboard',
      displayName: 'Dashboard Test User',
      email: 'dashboard@example.com',
    })

    await page.goto('/chat')

    await expect(page).toHaveURL(/\/profile-setup(?:\?.*)?$/)
    await expect(page.getByTestId('user-data-page')).toBeVisible()
  })
})
