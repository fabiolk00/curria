import { expect, test, type Page } from '@playwright/test'

import { authenticateE2EUser, clearE2EAuth } from './fixtures/auth-session'
import { buildMockWorkspace, installCoreFunnelApiMocks } from './fixtures/api-mocks'

function buildReadyProfileResponse() {
  return {
    profile: {
      id: 'profile_123',
      source: 'manual',
      cvState: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '+55 11 99999-0000',
        linkedin: 'https://linkedin.com/in/ana-silva',
        location: 'Sao Paulo, BR',
        summary: 'Backend engineer focused on platform reliability.',
        experience: [{
          title: 'Senior Backend Engineer',
          company: 'CurrIA',
          location: 'Sao Paulo, BR',
          startDate: '2022',
          endDate: 'Atual',
          bullets: ['Liderei a plataforma principal da empresa.'],
        }],
        skills: ['TypeScript', 'Node.js', 'AWS', 'PostgreSQL'],
        education: [{
          degree: 'Bacharel em Ciencia da Computacao',
          institution: 'USP',
          year: '2020',
        }],
        certifications: [{
          name: 'AWS Cloud Practitioner',
          issuer: 'Amazon',
          year: '2024',
        }],
      },
      profilePhotoUrl: null,
      createdAt: '2026-04-10T11:00:00.000Z',
      updatedAt: '2026-04-10T11:00:00.000Z',
      extractedAt: '2026-04-10T11:00:00.000Z',
      linkedinUrl: 'https://linkedin.com/in/ana-silva',
    },
  }
}

async function bootstrapProfileSetupPage(
  page: Page,
  options: {
    creditsRemaining?: number
    profile?: ReturnType<typeof buildReadyProfileResponse> | { profile: null }
    sessionId?: string
  } = {},
): Promise<void> {
  const sessionId = options.sessionId ?? 'sess_e2e_profile'
  const workspace = buildMockWorkspace(sessionId)

  await installCoreFunnelApiMocks(page, {
    sessionId,
    workspace,
    profile: options.profile ?? { profile: null },
  })

  await authenticateE2EUser(page, {
    appUserId: 'usr_e2e_profile',
    displayName: 'Profile Test User',
    email: 'profile@example.com',
    creditsRemaining: options.creditsRemaining ?? 3,
  })

  await page.goto('/dashboard/resumes/new')
  await expect(page.getByTestId('user-data-page')).toBeVisible()
}

async function fillMinimumReadyProfile(page: Page): Promise<void> {
  await page.getByPlaceholder('Nome completo').fill('Ana Teste')
  await page.getByPlaceholder('Email').fill('ana@example.com')
  await page.getByPlaceholder('Telefone').fill('+55 11 99999-0000')
  await page.getByPlaceholder('LinkedIn').fill('https://linkedin.com/in/ana-teste')
  await page.getByPlaceholder(/Localiza/i).first().fill('Sao Paulo, BR')
  await page.getByPlaceholder(/Escreva um resumo curto/i).fill('Backend engineer focused on platform reliability.')
  await page.getByPlaceholder(/Uma skill por linha/i).fill('TypeScript\nNode.js\nAWS')
}

test.describe('manual profile setup', () => {
  test('redirects guests away from /dashboard/resumes/new', async ({ page }) => {
    await clearE2EAuth(page)
    await page.goto('/dashboard/resumes/new')

    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  })

  test('redirects guests away from /dashboard/resume/new as well', async ({ page }) => {
    await clearE2EAuth(page)
    await page.goto('/dashboard/resume/new')

    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  })

  test('saves canonical profile data and stays on the profile setup flow', async ({ page }) => {
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

    await fillMinimumReadyProfile(page)
    await page.getByTestId('profile-save-button').click()

    await expect(page).toHaveURL(/\/dashboard\/resume\/new(?:\?.*)?$/)
    await expect(page.getByTestId('user-data-page')).toBeVisible()

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

  test('returns to /dashboard when cancelar is clicked', async ({ page }) => {
    await bootstrapProfileSetupPage(page)

    await page.getByRole('button', { name: 'Cancelar' }).click()

    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/)
    await expect(page.getByTestId('chat-interface')).toBeVisible()
  })

  test('opens and closes the import modal from the setup page', async ({ page }) => {
    await bootstrapProfileSetupPage(page)

    await page.getByRole('button', { name: 'Importar do LinkedIn ou PDF' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Importar perfil profissional')).toBeVisible()

    await page.getByRole('button', { name: 'Fechar' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('imports a base profile from PDF and fills the editor', async ({ page }) => {
    await bootstrapProfileSetupPage(page)

    await page.route('**/api/profile/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          profile: {
            cvState: {
              fullName: 'Bruna Costa',
              email: 'bruna@example.com',
              phone: '+55 11 98888-7777',
              linkedin: 'https://linkedin.com/in/bruna-costa',
              location: 'Recife, BR',
              summary: 'Product designer with strong ATS-friendly storytelling.',
              experience: [],
              skills: ['Figma', 'UX Writing', 'Design Systems'],
              education: [],
              certifications: [],
            },
            profilePhotoUrl: null,
            source: 'pdf',
          },
        }),
      })
    })

    await page.getByRole('button', { name: 'Importar do LinkedIn ou PDF' }).click()
    await page.locator('#resume-file-upload').setInputFiles({
      name: 'resume.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.1\n%CurrIA E2E PDF\n%%EOF'),
    })
    await page.getByRole('dialog').getByRole('button', { name: 'Importar arquivo' }).first().click()

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByText('Base salva a partir de curriculo importado')).toBeVisible()
    await expect(page.getByPlaceholder('Nome completo')).toHaveValue('Bruna Costa')
    await expect(page.getByPlaceholder('Email')).toHaveValue('bruna@example.com')
    await expect(page.getByPlaceholder(/Uma skill por linha/i)).toHaveValue('Figma\nUX Writing\nDesign Systems')
  })

  test('imports a base profile from LinkedIn and applies it to the editor', async ({ page }) => {
    let profileState: ReturnType<typeof buildReadyProfileResponse> | { profile: null } = { profile: null }

    await page.route('**/api/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profileState),
      })
    })

    await page.route('**/api/profile/extract', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jobId: 'job_linkedin_123' }),
      })
    })

    await page.route('**/api/profile/status/*', async (route) => {
      profileState = {
        profile: {
          id: 'profile_linkedin_123',
          source: 'linkedin',
          cvState: {
            fullName: 'Clara Nogueira',
            email: 'clara@example.com',
            phone: '+55 21 97777-6666',
            linkedin: 'https://linkedin.com/in/clara-nogueira',
            location: 'Rio de Janeiro, BR',
            summary: 'Product manager with strong discovery and delivery experience.',
            experience: [],
            skills: ['Product Strategy', 'Roadmaps', 'Stakeholder Management'],
            education: [],
            certifications: [],
          },
          profilePhotoUrl: null,
          createdAt: '2026-04-10T11:00:00.000Z',
          updatedAt: '2026-04-10T11:00:00.000Z',
          extractedAt: '2026-04-10T11:00:00.000Z',
          linkedinUrl: 'https://linkedin.com/in/clara-nogueira',
        },
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'completed' }),
      })
    })

    await authenticateE2EUser(page, {
      appUserId: 'usr_e2e_profile',
      displayName: 'Profile Test User',
      email: 'profile@example.com',
      creditsRemaining: 3,
    })

    await page.goto('/dashboard/resumes/new')
    await expect(page.getByTestId('user-data-page')).toBeVisible()

    await page.getByRole('button', { name: 'Importar do LinkedIn ou PDF' }).click()
    await page.getByPlaceholder('https://www.linkedin.com/in/seu-perfil').fill('https://linkedin.com/in/clara-nogueira')
    await page.getByRole('dialog').getByRole('button', { name: 'Importar do LinkedIn' }).click()

    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 })
    await expect(page.getByText('Base salva a partir do LinkedIn')).toBeVisible()
    await expect(page.getByPlaceholder('Nome completo')).toHaveValue('Clara Nogueira')
    await expect(page.getByPlaceholder('Email')).toHaveValue('clara@example.com')
    await expect(page.getByPlaceholder(/Uma skill por linha/i)).toHaveValue(
      'Product Strategy\nRoadmaps\nStakeholder Management',
    )
  })

  test('keeps the ATS action disabled when the user has no credits', async ({ page }) => {
    await bootstrapProfileSetupPage(page, {
      creditsRemaining: 0,
      profile: buildReadyProfileResponse(),
    })

    const atsButton = page.getByRole('button', { name: /Melhorar para ATS/i })

    await expect(atsButton).toBeDisabled()
    await expect(page.getByText(/Voce precisa de pelo menos 1 credito/i)).toBeVisible()
  })

  test('starts ATS enhancement from a ready base profile and lands on the generated session', async ({ page }) => {
    const sessionId = 'sess_ats_profile_setup'
    let atsPayload: Record<string, unknown> | null = null

    await bootstrapProfileSetupPage(page, {
      creditsRemaining: 2,
      profile: buildReadyProfileResponse(),
      sessionId,
    })

    await page.route('**/api/profile/ats-enhancement', async (route) => {
      atsPayload = route.request().postDataJSON() as Record<string, unknown>
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          sessionId,
          generationType: 'ATS_ENHANCEMENT',
        }),
      })
    })

    await page.getByRole('button', { name: /Melhorar para ATS/i }).click()

    await expect(page).toHaveURL(new RegExp(`/dashboard\\?session=${sessionId}$`))
    await expect(page.getByTestId('chat-interface')).toBeVisible()
    await expect(page.getByTestId('resume-workspace')).toHaveAttribute('data-session-id', sessionId)

    expect(atsPayload).toEqual({
      certifications: [
        {
          issuer: 'Amazon',
          name: 'AWS Cloud Practitioner',
          year: '2024',
        },
      ],
      education: [
        {
          degree: 'Bacharel em Ciencia da Computacao',
          institution: 'USP',
          year: '2020',
        },
      ],
      email: 'ana@example.com',
      experience: [
        {
          bullets: ['Liderei a plataforma principal da empresa.'],
          company: 'CurrIA',
          endDate: 'Atual',
          location: 'Sao Paulo, BR',
          startDate: '2022',
          title: 'Senior Backend Engineer',
        },
      ],
      fullName: 'Ana Silva',
      linkedin: 'https://linkedin.com/in/ana-silva',
      location: 'Sao Paulo, BR',
      phone: '+55 11 99999-0000',
      skills: ['TypeScript', 'Node.js', 'AWS', 'PostgreSQL'],
      summary: 'Backend engineer focused on platform reliability.',
    })
  })
})
