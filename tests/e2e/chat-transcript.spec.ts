import { expect, test } from '@playwright/test'

import { authenticateE2EUser } from './fixtures/auth-session'
import { buildMockWorkspace, installCoreFunnelApiMocks } from './fixtures/api-mocks'

test.describe('chat transcript integrity', () => {
  test('keeps one coherent rewrite transcript after degraded stream recovery and reload', async ({ page }) => {
    const sessionId = 'sess_e2e_transcript'
    const workspace = buildMockWorkspace(sessionId)
    const vacancyBootstrap =
      'Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo. Pontuacao ATS atual: 44/100. Posso seguir reescrevendo seu resumo ou experiencia com base nesses pontos.'

    await installCoreFunnelApiMocks(page, {
      sessionId,
      workspace,
      messages: [
        {
          role: 'assistant',
          content: vacancyBootstrap,
          createdAt: '2026-04-10T12:48:00.000Z',
        },
      ],
      streamChunks: [
        { type: 'text', content: 'Posso reescrever agora seu resumo profissional. ' },
        {
          type: 'error',
          error: 'Invalid gap analysis payload.',
          code: 'LLM_INVALID_OUTPUT',
        },
        { type: 'text', content: 'Ja tenho seu curriculo e a vaga como referencia.' },
        {
          type: 'done',
          sessionId,
          phase: 'dialog',
          atsScore: workspace.session.atsScore,
          messageCount: 3,
          isNewSession: false,
        },
      ],
    })

    await authenticateE2EUser(page, {
      appUserId: 'usr_e2e_transcript',
      displayName: 'Transcript User',
      email: 'transcript@example.com',
    })

    await page.goto(`/dashboard?session=${sessionId}`)

    await expect(page.getByText(/Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo\./i)).toHaveCount(1)

    await page.getByTestId('chat-input').fill('reescreva')
    await page.getByTestId('chat-send-button').click()

    await expect(
      page.getByText(/Posso reescrever agora seu resumo profissional\. Ja tenho seu curriculo e a vaga como referencia\./i),
    ).toHaveCount(1)
    await expect(page.getByText(/Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo\./i)).toHaveCount(1)

    await page.reload()

    await expect(page.getByTestId('chat-interface')).toHaveAttribute('data-session-id', sessionId)
    await expect(
      page.getByText(/Posso reescrever agora seu resumo profissional\. Ja tenho seu curriculo e a vaga como referencia\./i),
    ).toHaveCount(1)
    await expect(page.getByText(/Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo\./i)).toHaveCount(1)
  })
})
