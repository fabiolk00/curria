import { expect, test } from '@playwright/test'

import { authenticateE2EUser } from './fixtures/auth-session'
import { buildMockWorkspace, installCoreFunnelApiMocks } from './fixtures/api-mocks'

test.describe('dashboard core funnel', () => {
  test('opens generated resume comparison and downloads the PDF artifact', async ({ page }) => {
    const sessionId = 'sess_e2e_core'
    const workspace = buildMockWorkspace(sessionId)
    workspace.targets = [
      {
        id: 'target_001',
        sessionId,
        targetJobDescription: 'Platform engineer role with Kubernetes ownership',
        derivedCvState: {
          ...workspace.session.cvState,
          summary: 'Platform engineer focused on Kubernetes, AWS, and reliability.',
        },
        generatedOutput: {
          status: 'ready',
          pdfPath: `${sessionId}/targets/target_001/resume.pdf`,
          generatedAt: '2026-04-10T12:06:00.000Z',
        },
        createdAt: '2026-04-10T12:05:30.000Z',
        updatedAt: '2026-04-10T12:06:00.000Z',
      },
    ]

    await installCoreFunnelApiMocks(page, {
      sessionId,
      workspace,
    })
    await authenticateE2EUser(page, {
      appUserId: 'usr_e2e_core',
      displayName: 'Core Funnel User',
      email: 'core@example.com',
    })

    await page.goto(`/dashboard/resume/compare/${sessionId}`)

    await expect(page.getByTestId('resume-comparison-view')).toBeVisible()
    await expect(page.getByTestId('job-target-resume-frame')).toBeVisible()
    await expect(page.getByTestId('original-resume-document')).toHaveCount(0)
    await expect(page.getByTestId('optimized-resume-document')).toContainText('Kubernetes')

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTitle('Baixar PDF').click(),
    ])

    expect(download.suggestedFilename()).toBe('Curriculo_Usuario_Vaga.pdf')
  })
})
