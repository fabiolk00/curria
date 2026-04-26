import { describe, expect, it } from 'vitest'

import { buildAtsReadinessContractForEnhancement, buildBaselineAtsReadinessContract } from './index'
import { bandFromScore } from './display-score'
import { ATS_READINESS_CONTRACT_VERSION } from './types'

const BASE_CV = {
  fullName: 'Ana Silva',
  email: 'ana@example.com',
  phone: '555-0100',
  summary: 'Analista de dados com experiência em SQL.',
  experience: [{
    title: 'Analista de Dados',
    company: 'Acme',
    startDate: '2022',
    endDate: 'present' as const,
    bullets: ['Criei dashboards semanais.'],
  }],
  skills: ['SQL', 'Power BI', 'Excel'],
  education: [{
    degree: 'Sistemas de Informacao',
    institution: 'USP',
    year: '2020',
  }],
}

const cleanRewriteValidation = {
  blocked: false,
  valid: true,
  hardIssues: [],
  softWarnings: [],
  issues: [],
}

describe('ATS readiness scoring contract', () => {
  it('emits the ATS Readiness contract as v2', () => {
    expect(ATS_READINESS_CONTRACT_VERSION).toBe(2)
  })

  it('builds a baseline displayed score from the raw internal score', () => {
    const contract = buildBaselineAtsReadinessContract({ cvState: BASE_CV })

    expect(contract.contractVersion).toBe(ATS_READINESS_CONTRACT_VERSION)
    expect(contract.rawInternalScoreBefore).toBeGreaterThanOrEqual(0)
    expect(contract.displayedReadinessScoreBefore).toBe(contract.displayedReadinessScoreCurrent)
    expect(contract.displayedReadinessScoreAfter).toBeNull()
    expect(contract.scoreStatus).toBe('final')
    expect(contract.display.mode).toBe('exact')
    expect(contract.display.formattedScorePtBr).toBe(String(contract.displayedReadinessScoreBefore))
  })

  it('keeps the raw internal score honest even when the displayed score is monotonic', () => {
    const contract = buildAtsReadinessContractForEnhancement({
      originalCvState: {
        ...BASE_CV,
        summary: 'Analista de dados com experiência em SQL e ETL para analytics com foco em resultados de negócio.',
        experience: [{
          ...BASE_CV.experience[0],
          bullets: ['Implementei pipelines SQL e reduzi o tempo de fechamento em 30%.'],
        }],
      },
      optimizedCvState: {
        ...BASE_CV,
        summary: 'Analista de dados.',
      },
      rewriteValidation: cleanRewriteValidation,
      optimizationSummary: {
        changedSections: ['summary'],
        notes: ['Resumo simplificado.'],
        keywordCoverageImprovement: ['SQL'],
      },
      previousContract: {
        ...buildBaselineAtsReadinessContract({
          cvState: {
            ...BASE_CV,
        summary: 'Analista de dados com experiência em SQL e ETL para analytics com foco em resultados de negócio.',
            experience: [{
              ...BASE_CV.experience[0],
              bullets: ['Implementei pipelines SQL e reduzi o tempo de fechamento em 30%.'],
            }],
          },
        }),
        displayedReadinessScoreBefore: 91,
        displayedReadinessScoreCurrent: 91,
        displayedReadinessBandBefore: 'excellent',
        displayedReadinessBandCurrent: 'excellent',
      },
    })

    expect(contract.rawInternalScoreAfter).toBeLessThanOrEqual(contract.rawInternalScoreBefore)
    expect(contract.displayedReadinessScoreAfter).toBeGreaterThanOrEqual(contract.displayedReadinessScoreBefore)
  })

  it('forces a minimum displayed score of 89 and caps at 95 when gates pass', () => {
    const contract = buildAtsReadinessContractForEnhancement({
      originalCvState: BASE_CV,
      optimizedCvState: {
        ...BASE_CV,
        summary: 'Analista de dados com foco em SQL, BI e entrega de indicadores para decisao executiva com melhor clareza e contexto.',
        experience: [{
          ...BASE_CV.experience[0],
          bullets: ['Implementei dashboards em Power BI e reduzi o tempo de reporte em 25%.'],
        }],
        skills: ['SQL', 'Power BI', 'Excel', 'ETL'],
      },
      rewriteValidation: cleanRewriteValidation,
      optimizationSummary: {
        changedSections: ['summary', 'experience', 'skills'],
        notes: ['Maior clareza e impacto.'],
        keywordCoverageImprovement: ['SQL', 'Power BI'],
      },
    })

    expect(contract.scoreStatus).toBe('final')
    expect(contract.displayedReadinessScoreAfter).not.toBeNull()
    expect(contract.displayedReadinessScoreAfter!).toBeGreaterThanOrEqual(89)
    expect(contract.displayedReadinessScoreAfter!).toBeLessThanOrEqual(95)
    expect(contract.display.mode).toBe('exact')
  })

  it('allows a clearer executive summary to pass even when it is not longer than the original', () => {
    const contract = buildAtsReadinessContractForEnhancement({
      originalCvState: {
        ...BASE_CV,
        summary: 'Analista de dados com experiência em SQL, apoio a relatorios, contato com areas internas e suporte geral a analises.',
      },
      optimizedCvState: {
        ...BASE_CV,
        summary: 'Analista de dados com foco em SQL, BI e indicadores executivos para decisoes de negocio.',
      },
      rewriteValidation: cleanRewriteValidation,
      optimizationSummary: {
        changedSections: ['summary', 'skills'],
        notes: ['Resumo ficou mais claro e executivo.'],
        keywordCoverageImprovement: ['SQL', 'BI'],
      },
    })

    expect(contract.qualityGates.improvedSummaryClarity).toBe(true)
    expect(contract.scoreStatus).toBe('final')
  })

  it('keeps the summary clarity gate closed when the rewrite stays too close or structurally noisy', () => {
    const contract = buildAtsReadinessContractForEnhancement({
      originalCvState: {
        ...BASE_CV,
        summary: 'Analista de dados com foco em SQL e Power BI para analytics.',
      },
      optimizedCvState: {
        ...BASE_CV,
        summary: 'Resumo Profissional: Analista de dados com foco em SQL e Power BI para analytics.',
      },
      rewriteValidation: cleanRewriteValidation,
      optimizationSummary: {
        changedSections: ['summary'],
        notes: ['Resumo alterado superficialmente.'],
        keywordCoverageImprovement: ['SQL'],
      },
    })

    expect(contract.qualityGates.improvedSummaryClarity).toBe(false)
    expect(contract.withholdReasons).toContain(
      'Summary clarity did not improve enough to justify a final readiness score.',
    )
  })

  it('uses explicit keyword improvement for ATS enhancement instead of depending on the no-JD fallback', () => {
    const contract = buildAtsReadinessContractForEnhancement({
      originalCvState: BASE_CV,
      optimizedCvState: {
        ...BASE_CV,
        summary: 'Analista de dados com foco em SQL, Power BI e ETL para indicadores executivos.',
        experience: [{
          ...BASE_CV.experience[0],
          bullets: ['Estruturei indicadores em SQL e Power BI para decisoes executivas.'],
        }],
      },
      rewriteValidation: cleanRewriteValidation,
      optimizationSummary: {
        changedSections: ['summary', 'experience'],
        notes: ['Mais visibilidade para stack principal.'],
        keywordCoverageImprovement: ['SQL', 'Power BI', 'ETL'],
      },
    })

    expect(contract.qualityGates.improvedKeywordVisibility).toBe(true)
    expect(contract.scoreStatus).toBe('final')
  })

  it('keeps the no-JD fallback as backup only and does not let it override an explicit empty keyword signal', () => {
    const contract = buildAtsReadinessContractForEnhancement({
      originalCvState: BASE_CV,
      optimizedCvState: {
        ...BASE_CV,
        summary: 'Liderei e implementei rotinas para analise operacional.',
        experience: [{
          ...BASE_CV.experience[0],
          bullets: ['Implementei e otimizei processos com apoio ao time.'],
        }],
      },
      rewriteValidation: cleanRewriteValidation,
      optimizationSummary: {
        changedSections: ['summary', 'experience'],
        notes: ['Mais verbos de acao, sem ganho explicito de keywords.'],
        keywordCoverageImprovement: [],
      },
    })

    expect(contract.rawScoreAfter.breakdown.keywords).toBeGreaterThan(contract.rawScoreBefore.breakdown.keywords)
    expect(contract.qualityGates.improvedKeywordVisibility).toBe(false)
    expect(contract.withholdReasons).toContain(
      'Keyword visibility did not improve enough to justify a final readiness score.',
    )
  })

  it('converts the old withheld path into an estimated numeric range when quality gates fail', () => {
    const contract = buildAtsReadinessContractForEnhancement({
      originalCvState: BASE_CV,
      optimizedCvState: {
        ...BASE_CV,
        summary: 'Resumo curto',
        education: [],
      },
      rewriteValidation: {
        blocked: true,
        valid: false,
        hardIssues: [{ severity: 'high', message: 'Unsupported claims.', section: 'summary' }],
        softWarnings: [],
        issues: [{ severity: 'high', message: 'Unsupported claims.', section: 'summary' }],
      },
      optimizationSummary: {
        changedSections: ['summary'],
        notes: ['Resumo alterado.'],
      },
    })

    expect(contract.scoreStatus).toBe('estimated_range')
    expect(contract.display.mode).toBe('estimated_range')
    expect(contract.display.exactScore).toBeNull()
    expect(contract.display.estimatedRangeMin).toBeGreaterThanOrEqual(89)
    expect(contract.display.estimatedRangeMax).toBeLessThanOrEqual(95)
    expect((contract.display.estimatedRangeMax ?? 0) - (contract.display.estimatedRangeMin ?? 0)).toBeLessThanOrEqual(2)
    expect(contract.display.formattedScorePtBr).toMatch(/^\d+(–\d+)?$/)
    expect(contract.displayedReadinessScoreAfter).toBe(contract.display.estimatedRangeMin)
    expect(contract.withholdReasons.length).toBeGreaterThan(0)
  })

  it('classifies low-confidence degraded input conservatively', () => {
    const contract = buildBaselineAtsReadinessContract({
      cvState: {
        fullName: 'Ana',
        email: '',
        phone: '',
        summary: '',
        experience: [],
        skills: [],
        education: [],
      },
    })

    expect(contract.rawInternalConfidence).toBe('low')
  })

  it('keeps monotonic estimated ranges when low-confidence input regresses core internal signals', () => {
    const contract = buildAtsReadinessContractForEnhancement({
      originalCvState: {
        ...BASE_CV,
        summary: 'Analista de dados com experiência em SQL, BI, ETL e comunicação com lideranças para decisão.',
        experience: [{
          ...BASE_CV.experience[0],
          bullets: ['Implementei dashboards em Power BI e reduzi o tempo de reporte em 25%.'],
        }],
        skills: ['SQL', 'Power BI', 'ETL', 'Excel', 'Indicadores'],
      },
      optimizedCvState: {
        ...BASE_CV,
        summary: 'Analista.',
        experience: [{
          ...BASE_CV.experience[0],
          bullets: ['Atuei em analise.'],
        }],
        skills: ['SQL'],
      },
      rewriteValidation: cleanRewriteValidation,
      optimizationSummary: {
        changedSections: ['summary', 'experience', 'skills'],
        notes: ['Versao curta.'],
      },
    })

    expect(contract.rawInternalConfidence).toBe('low')
    expect(contract.scoreStatus).toBe('estimated_range')
    expect(contract.display.estimatedRangeMin).toBeGreaterThanOrEqual(contract.displayedReadinessScoreBefore)
    expect(contract.withholdReasons).toContain('Low scoring confidence combined with contradictory internal ATS signals.')
  })

  it('maps readiness bands deterministically', () => {
    expect(bandFromScore(69)).toBe('needs_work')
    expect(bandFromScore(70)).toBe('borderline')
    expect(bandFromScore(80)).toBe('ats_ready')
    expect(bandFromScore(89)).toBe('excellent')
  })
})
