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
  test('submits a near-limit vacancy through Smart Generation and opens comparison', async ({ page }) => {
    const sessionId = 'sess_e2e_long_vacancy'
    const workspace = buildMockWorkspace(sessionId)
    workspace.session.cvState.experience = [
      {
        title: 'Analista de BI',
        company: 'Dados Brasil',
        location: 'Sao Paulo, BR',
        startDate: '2021-01',
        endDate: 'present',
        bullets: [
          'Construiu dashboards executivos em Power BI para operacoes, vendas e controladoria.',
          'Automatizou pipelines SQL e ETL para indicadores de performance comercial.',
        ],
      },
    ]
    workspace.session.cvState.education = [
      {
        degree: 'Bacharelado em Sistemas de Informacao',
        institution: 'Universidade Exemplo',
        year: '2020',
      },
    ]
    const longVacancyText = buildLongVacancyText()
    let submittedTargetJobDescription = ''

    await installCoreFunnelApiMocks(page, {
      sessionId,
      workspace,
    })
    await page.route('**/api/profile/smart-generation', async (route) => {
      const body = route.request().postDataJSON() as { targetJobDescription?: string }
      submittedTargetJobDescription = body.targetJobDescription ?? ''
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          sessionId,
          creditsUsed: 1,
          resumeGenerationId: 'gen_e2e_long_vacancy',
          generationType: 'JOB_TARGETING',
          originalCvState: workspace.session.cvState,
          optimizedCvState: {
            ...workspace.session.cvState,
            summary: 'Analista de BI Senior com foco em Power BI, SQL, ETL e storytelling executivo.',
          },
        }),
      })
    })

    await authenticateE2EUser(page, {
      appUserId: 'usr_e2e_long_vacancy',
      displayName: 'Long Vacancy User',
      email: 'long-vacancy@example.com',
    })

    await page.goto('/profile-setup')
    await page.getByRole('button', { name: /Melhorar curr/i }).click()
    await page.getByTestId('enhancement-intent-target-job').click()
    await page.getByTestId('target-job-description-input').fill(longVacancyText)
    await page.getByTestId('ats-panel-cta').click()

    await expect(page).toHaveURL(new RegExp(`/dashboard/resume/compare/${sessionId}$`))
    await expect(page.getByTestId('resume-comparison-view')).toBeVisible()
    expect(submittedTargetJobDescription.length).toBeGreaterThan(7000)
    expect(submittedTargetJobDescription).toBe(longVacancyText)
  })
})
