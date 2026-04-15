import { describe, expect, it } from 'vitest'

import {
  detectTargetJobDescription,
  looksLikeJobDescription,
  normalizeForJobDescriptionDetection,
} from './vacancy-analysis'

describe('vacancy-analysis', () => {
  it('detects a structured vacancy with high confidence', () => {
    const vacancy = `Analista de BI Senior

Responsabilidades:
Construir dashboards em Power BI com foco em usabilidade.
Automatizar processos de coleta e transformacao de dados.
Apresentar insights para as areas de negocio.

Requisitos:
Experiencia com Power BI, SQL, ETL e modelagem de dados.
Boa comunicacao com stakeholders e lideranca.

Diferenciais:
Python, APIs e Microsoft Fabric.`

    expect(detectTargetJobDescription(vacancy)).toEqual({
      targetJobDescription: vacancy,
      confidence: 'high',
    })
    expect(looksLikeJobDescription(vacancy)).toBe(true)
  })

  it('preserves summarized requirement-list vacancies as high confidence detections', () => {
    const requirementSummary = [
      'Requisitos Desejaveis',
      '',
      'Experiencia em analises que envolvem multiplas areas de negocio. Vivencia em GitHub, Looker ou outras ferramentas de data visualization. Capacidade de resolver problemas com foco em resultados para o negocio.',
      '',
      'Resumo dos requisitos: SQL, Google Sheets, Looker Platform, Machine Learning, GitHub, R, BigQuery, SQL Server, Google Analytics, Google Tag Manager, Appsflyer.',
    ].join('\n')

    expect(detectTargetJobDescription(requirementSummary)).toEqual({
      targetJobDescription: requirementSummary,
      confidence: 'high',
    })
    expect(looksLikeJobDescription(requirementSummary)).toBe(true)
  })

  it('treats scraped vacancy payloads as high confidence', () => {
    const scrapedPayload = [
      '[Link da vaga: https://example.com/jobs/analytics-engineer]',
      '',
      '[ConteÃƒÂºdo extraÃƒÂ­do automaticamente]',
      '',
      'Senior Analytics Engineer com foco em dbt, SQL e BigQuery.',
    ].join('\n')

    expect(detectTargetJobDescription(scrapedPayload)).toEqual({
      targetJobDescription: scrapedPayload,
      confidence: 'high',
    })
  })

  it('does not classify resume-only text as a vacancy', () => {
    const resumeSummary = [
      'Sou analista de dados com foco em BI, SQL e automacao.',
      'Tenho experiencia com Power BI, ETL e apresentacao de indicadores.',
      'Procuro melhorar meu curriculo para vagas em analytics.',
    ].join(' ')

    expect(detectTargetJobDescription(resumeSummary)).toBeUndefined()
    expect(looksLikeJobDescription(resumeSummary)).toBe(false)
  })

  it('normalizes accents before evaluating vacancy heuristics', () => {
    expect(normalizeForJobDescriptionDetection('Qualificações e posição')).toBe('qualificacoes e posicao')
  })
})
