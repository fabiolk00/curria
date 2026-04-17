import { expect, test } from '@playwright/test'

import { authenticateE2EUser } from './fixtures/auth-session'
import { buildMockWorkspace, installCoreFunnelApiMocks } from './fixtures/api-mocks'

function buildLongVacancyText(targetLength = 7600): string {
  const leadParagraphs = [
    'O que procuramos?',
    'Buscamos um Analista de BI Senior com dominio avancado de Power BI, DAX, SQL, ETL, storytelling de dados e traducao consultiva de necessidades de negocio em indicadores estrategicos para alta gestao.',
    'Responsabilidades:',
    'Levantar requisitos com controladoria, vendas, RH, operacoes e liderancas executivas; estruturar indicadores acionaveis; desenhar dashboards de alta clareza; tratar qualidade de dados; automatizar pipelines; integrar APIs; apoiar a modernizacao do ambiente analitico; e sustentar a tomada de decisao com narrativas executivas consistentes.',
    'Requisitos:',
    'Experiencia solida com Power BI, modelagem semantica, DAX, SQL, ETL, integracao entre sistemas, documentacao de metricas, governanca de dados, comunicacao com stakeholders nao tecnicos e priorizacao consultiva de backlog analitico.',
    'Diferenciais:',
    'Python, Fabric, APIs, modelagem de dados, arquitetura analitica, indicadores financeiros, controladoria, vendas, RH, planejamento, previsoes, analise de performance comercial e apresentacoes para diretorias.',
  ]

  const fillerParagraph =
    'Contexto adicional da vaga: precisamos de uma pessoa que consiga consolidar dados dispersos, revisar regras de negocio com profundidade, negociar prioridades com varias areas, manter confiabilidade de metricas historicas, orientar liderancas sobre leitura de indicadores, criar pain points acionaveis para decisoes de curto e medio prazo, revisar fontes legadas, padronizar nomenclaturas, manter transparencia sobre limitacoes dos dados, e produzir dashboards elegantes, acessiveis e objetivos sem perder rastreabilidade tecnica.'

  let text = leadParagraphs.join('\n\n')

  while (text.length < targetLength) {
    text = `${text}\n\n${fillerParagraph}`
  }

  return text.slice(0, targetLength)
}

test.describe('long vacancy generation stress', () => {
  test('handles a near-limit vacancy, repeated generation, and template rendering stability', async ({ page }) => {
    const sessionId = 'sess_e2e_long_vacancy'
    const workspace = buildMockWorkspace(sessionId)
    const longVacancyText = buildLongVacancyText()

    workspace.session.generatedOutput = {
      status: 'idle',
    }
    workspace.session.messageCount = 0
    workspace.session.agentState.targetJobDescription = undefined
    workspace.session.agentState.gapAnalysis = undefined

    await installCoreFunnelApiMocks(page, {
      sessionId,
      workspace,
      messages: [],
      streamChunks: [
        { type: 'sessionCreated', sessionId },
        {
          type: 'text',
          content: 'Recebi a vaga longa, salvei a referencia e preparei a analise inicial. ',
        },
        {
          type: 'done',
          sessionId,
          phase: 'analysis',
          atsScore: workspace.session.atsScore,
          messageCount: 2,
          isNewSession: true,
        },
      ],
    })

    await authenticateE2EUser(page, {
      appUserId: 'usr_e2e_long_vacancy',
      displayName: 'Long Vacancy User',
      email: 'long-vacancy@example.com',
    })

    await page.goto('/dashboard')
    await expect(page.getByTestId('resume-workspace')).toHaveAttribute('data-base-output-ready', 'false')

    await page.getByTestId('chat-input').fill(longVacancyText)
    await page.getByTestId('chat-send-button').click()

    await expect(page).toHaveURL(new RegExp(`/dashboard\\?session=${sessionId}$`))
    await expect(page.getByTestId('chat-interface')).toHaveAttribute('data-session-id', sessionId)
    await expect(page.getByTestId('chat-interface')).toHaveAttribute('data-message-count', '2')
    await expect(
      page.getByText(/Recebi a vaga longa, salvei a referencia e preparei a analise inicial\./i),
    ).toHaveCount(1)
    await expect(page.getByText(/Gere um arquivo\./i)).toBeVisible()

    const revisitWorkspace = async () => {
      await page.goto(`/dashboard?session=${sessionId}`, { waitUntil: 'domcontentloaded' })
    }

    for (let iteration = 1; iteration <= 3; iteration += 1) {
      const generationResult = await page.evaluate(async ({ targetSessionId }) => {
        const response = await fetch(`/api/session/${targetSessionId}/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ scope: 'base' }),
        })

        return {
          ok: response.ok,
          status: response.status,
          body: await response.json(),
        }
      }, { targetSessionId: sessionId })

      expect(generationResult.ok).toBe(true)
      expect(generationResult.status).toBe(200)
      expect(generationResult.body).toMatchObject({
        success: true,
        scope: 'base',
      })

      await revisitWorkspace()

      await expect(
        page.getByTestId('resume-workspace'),
        `base output should stay ready after generation cycle ${iteration}`,
      ).toHaveAttribute('data-base-output-ready', 'true')
      await expect(
        page.getByTestId('preview-panel'),
        `preview should stay ready after generation cycle ${iteration}`,
      ).toHaveAttribute('data-state', 'ready')
      await expect(
        page.getByTestId('preview-panel-frame'),
        `template viewer should keep the generated PDF mounted after cycle ${iteration}`,
      ).toHaveAttribute('src', /__e2e-assets\/resume\.pdf/)
      await expect(page.getByTestId('session-documents-panel')).toHaveAttribute('data-state', 'ready')
    }

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('document-item-pdf').click(),
    ])

    expect(download.suggestedFilename()).toBe('Resume.pdf')
    expect(longVacancyText.length).toBeGreaterThan(7000)
  })
})
