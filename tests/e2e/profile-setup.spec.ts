import { expect, test } from '@playwright/test'

import { authenticateE2EUser, clearE2EAuth } from './fixtures/auth-session'
import { installCoreFunnelApiMocks } from './fixtures/api-mocks'

test.describe('manual profile setup', () => {
  test('redirects guests, saves canonical profile data, and lands on /dashboard', async ({ page }) => {
    await clearE2EAuth(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)

    let savedProfilePayload: Record<string, unknown> | null = null

    await installCoreFunnelApiMocks(page, {
      profile: { profile: null },
      onProfileSave: async (payload) => {
        savedProfilePayload = payload
      },
    })
    await authenticateE2EUser(page, {
      appUserId: 'usr_e2e_profile',
      displayName: 'Profile Test User',
      email: 'profile@example.com',
    })

    await page.goto('/dashboard/resumes/new')

    await page.getByPlaceholder('Nome completo').fill('Ana Teste')
    await page.getByPlaceholder('Email').fill('ana@example.com')
    await page.getByPlaceholder('Telefone').fill('+55 11 99999-0000')
    await page.getByPlaceholder('LinkedIn').fill('https://linkedin.com/in/ana-teste')
    await page.getByPlaceholder(/Localiza/i).first().fill('Sao Paulo, BR')
    await page.getByPlaceholder(/Escreva um resumo curto/i).fill('Backend engineer focused on platform reliability.')
    await page.getByPlaceholder(/Uma skill por linha/i).fill('TypeScript\nNode.js\nAWS')

    await page.getByTestId('profile-save-button').click()

    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/)
    await expect(page.getByTestId('chat-interface')).toBeVisible()

    expect(savedProfilePayload).toEqual({
      education: [],
      email: 'ana@example.com',
      experience: [],
      fullName: 'Ana Teste',
      linkedin: 'https://linkedin.com/in/ana-teste',
      location: 'Sao Paulo, BR',
      phone: '+55 11 99999-0000',
      skills: ['TypeScript', 'Node.js', 'AWS'],
      summary: 'Backend engineer focused on platform reliability.',
    })
  })
})
