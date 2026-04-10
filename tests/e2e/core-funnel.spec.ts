import { expect, test } from '@playwright/test'

import { authenticateE2EUser } from './fixtures/auth-session'
import { buildMockWorkspace, installCoreFunnelApiMocks } from './fixtures/api-mocks'

test.describe('dashboard core funnel', () => {
  test('creates a session, exposes target state, and delivers artifacts', async ({ page }) => {
    const sessionId = 'sess_e2e_core'
    const workspace = buildMockWorkspace(sessionId)
    workspace.targets = [
      {
        id: 'target_001',
        sessionId,
        targetJobDescription: 'Platform engineer role with Kubernetes ownership',
        derivedCvState: workspace.session.cvState,
        generatedOutput: {
          status: 'ready',
          docxPath: `${sessionId}/targets/target_001/resume.docx`,
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
      streamChunks: [
        { type: 'sessionCreated', sessionId },
        { type: 'text', content: 'Analise iniciada. ' },
        {
          type: 'done',
          sessionId,
          phase: 'dialog',
          atsScore: workspace.session.atsScore,
          messageCount: 2,
          isNewSession: true,
        },
      ],
    })
    await authenticateE2EUser(page, {
      appUserId: 'usr_e2e_core',
      displayName: 'Core Funnel User',
      email: 'core@example.com',
    })

    await page.goto('/dashboard')
    await expect(page.getByTestId('chat-interface')).toHaveAttribute('data-session-id', '')

    await page.getByTestId('chat-input').fill('Platform engineer role focused on Kubernetes and AWS')
    await page.getByTestId('chat-send-button').click()

    await expect(page).toHaveURL(new RegExp(`/dashboard\\?session=${sessionId}$`))
    await expect(page.getByTestId('chat-interface')).toHaveAttribute('data-session-id', sessionId)
    await expect(page.getByTestId('resume-workspace')).toHaveAttribute('data-session-id', sessionId)
    await expect(page.getByTestId('resume-workspace')).toHaveAttribute('data-target-count', '1')
    await expect(page.getByTestId('resume-workspace')).toHaveAttribute('data-base-output-ready', 'true')

    await expect(page.getByTestId('session-documents-panel')).toHaveAttribute('data-state', 'ready')
    await expect(page.getByTestId('preview-panel')).toHaveAttribute('data-state', 'ready')
    await expect(page.getByTestId('preview-panel-frame')).toHaveAttribute('src', /__e2e-assets\/resume\.pdf/)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('document-item-docx').click(),
    ])

    expect(download.suggestedFilename()).toBe('Resume.docx')
  })
})
