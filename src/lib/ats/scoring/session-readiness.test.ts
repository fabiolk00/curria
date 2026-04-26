import { describe, expect, it } from 'vitest'

import { normalizePersistedAtsReadiness, resolveSessionAtsReadiness } from './session-readiness'
import { ATS_READINESS_CONTRACT_VERSION } from './types'
import type { RewriteSectionInput } from '@/types/agent'

const CHANGED_SECTIONS: RewriteSectionInput['section'][] = ['summary', 'experience', 'skills']

const cleanRewriteValidation = {
  blocked: false,
  valid: true,
  hardIssues: [],
  softWarnings: [],
  issues: [],
}

const BASE_SESSION = {
  cvState: {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    summary: 'Resumo base com SQL e BI.',
    experience: [{
      title: 'Analista',
      company: 'Acme',
      startDate: '2022',
      endDate: '2024',
      bullets: ['Criei dashboards e reduzi o tempo de reporte em 20%.'],
    }],
    skills: ['SQL', 'Power BI', 'ETL'],
    education: [{
      degree: 'Bacharel em Sistemas',
      institution: 'USP',
      year: '2020',
    }],
  },
  agentState: {
    workflowMode: 'ats_enhancement' as const,
    parseStatus: 'parsed' as const,
    rewriteHistory: {},
    rewriteValidation: cleanRewriteValidation,
    optimizationSummary: {
      changedSections: CHANGED_SECTIONS,
      notes: ['Resumo melhorado.'],
      keywordCoverageImprovement: ['SQL'],
    },
    optimizedCvState: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Resumo otimizado com SQL, BI e foco em indicadores.',
      experience: [{
        title: 'Analista',
        company: 'Acme',
        startDate: '2022',
        endDate: '2024',
        bullets: ['Estruturei dashboards executivos e reduzi o tempo de reporte em 25%.'],
      }],
      skills: ['SQL', 'Power BI', 'ETL', 'Dashboards'],
      education: [{
        degree: 'Bacharel em Sistemas',
        institution: 'USP',
        year: '2020',
      }],
    },
  },
}

describe('session ATS readiness resolver', () => {
  it('derives a canonical fallback for legacy ATS sessions without atsReadiness', () => {
    const readiness = resolveSessionAtsReadiness({
      session: BASE_SESSION,
    })

    expect(readiness).toBeDefined()
    expect(readiness?.contractVersion).toBe(ATS_READINESS_CONTRACT_VERSION)
    expect(readiness?.productLabel).toBe('ATS Readiness Score')
    expect(readiness?.display.formattedScorePtBr).toMatch(/^\d+([–-]\d+)?$/)
  })

  it('upgrades persisted readiness contracts that predate the contract version marker', () => {
    const readiness = resolveSessionAtsReadiness({
      session: {
        ...BASE_SESSION,
        agentState: {
          ...BASE_SESSION.agentState,
          atsReadiness: {
            workflowMode: 'ats_enhancement',
            evaluationStage: 'post_enhancement',
            productLabel: 'ATS Readiness Score',
            rawInternalScoreSource: 'scoreATS.total',
            rawInternalScoreBefore: 70,
            rawInternalScoreAfter: 72,
            rawInternalConfidence: 'medium',
            displayedReadinessScoreBefore: 80,
            displayedReadinessScoreAfter: 89,
            displayedReadinessBandBefore: 'ats_ready',
            displayedReadinessBandAfter: 'excellent',
            displayedReadinessScoreCurrent: 89,
            displayedReadinessBandCurrent: 'excellent',
            scoreStatus: 'final',
            qualityGates: {
              improvedSummaryClarity: true,
              improvedKeywordVisibility: true,
              noFactualDrift: true,
              noLossOfRequiredSections: true,
              noReadabilityRegression: true,
              noUnsupportedClaimsIntroduced: true,
            },
            withholdReasons: [],
            rawScoreBefore: {
              total: 70,
              breakdown: { format: 15, structure: 15, contact: 8, keywords: 15, impact: 17 },
              issues: [],
              suggestions: [],
            },
            rawScoreAfter: {
              total: 72,
              breakdown: { format: 16, structure: 15, contact: 8, keywords: 16, impact: 17 },
              issues: [],
              suggestions: [],
            },
            } as unknown as import('./types').AtsReadinessScoreContract,
        },
      },
    })

    expect(readiness?.contractVersion).toBe(ATS_READINESS_CONTRACT_VERSION)
    expect(readiness?.displayedReadinessScoreCurrent).toBe(89)
    expect(readiness?.display.mode).toBe('exact')
  })

  it('converts persisted withheld_pending_quality contracts into estimated ranges', () => {
    const readiness = resolveSessionAtsReadiness({
      session: {
        ...BASE_SESSION,
        agentState: {
          ...BASE_SESSION.agentState,
          atsReadiness: {
            workflowMode: 'ats_enhancement',
            evaluationStage: 'post_enhancement',
            productLabel: 'ATS Readiness Score',
            rawInternalScoreSource: 'scoreATS.total',
            rawInternalScoreBefore: 70,
            rawInternalScoreAfter: 61,
            rawInternalConfidence: 'low',
            displayedReadinessScoreBefore: 89,
            displayedReadinessScoreAfter: null,
            displayedReadinessBandBefore: 'excellent',
            displayedReadinessBandAfter: null,
            displayedReadinessScoreCurrent: 89,
            displayedReadinessBandCurrent: 'excellent',
            scoreStatus: 'withheld_pending_quality',
            qualityGates: {
              improvedSummaryClarity: false,
              improvedKeywordVisibility: false,
              noFactualDrift: true,
              noLossOfRequiredSections: true,
              noReadabilityRegression: false,
              noUnsupportedClaimsIntroduced: true,
            },
            withholdReasons: ['Low scoring confidence combined with contradictory internal ATS signals.'],
            rawScoreBefore: {
              total: 70,
              breakdown: { format: 15, structure: 15, contact: 8, keywords: 15, impact: 17 },
              issues: [],
              suggestions: [],
            },
            rawScoreAfter: {
              total: 61,
              breakdown: { format: 12, structure: 12, contact: 8, keywords: 14, impact: 15 },
              issues: [],
              suggestions: [],
            },
            } as unknown as import('./types').AtsReadinessScoreContract,
        },
      },
    })

    expect(readiness?.scoreStatus).toBe('estimated_range')
    expect(readiness?.contractVersion).toBe(ATS_READINESS_CONTRACT_VERSION)
    expect(readiness?.display.mode).toBe('estimated_range')
    expect(readiness?.display.formattedScorePtBr).toBe('89–90')
  })

  it('normalizes persisted v1 payloads into the v2 display contract', () => {
    const readiness = normalizePersistedAtsReadiness({
      contractVersion: 1,
      workflowMode: 'ats_enhancement',
      evaluationStage: 'post_enhancement',
      productLabel: 'ATS Readiness Score',
      rawInternalScoreSource: 'scoreATS.total',
      rawInternalScoreBefore: 74,
      rawInternalScoreAfter: 75,
      rawInternalConfidence: 'medium',
      displayedReadinessScoreBefore: 89,
      displayedReadinessScoreAfter: null,
      displayedReadinessBandBefore: 'excellent',
      displayedReadinessBandAfter: null,
      displayedReadinessScoreCurrent: 89,
      displayedReadinessBandCurrent: 'excellent',
      scoreStatus: 'withheld_pending_quality',
      qualityGates: {
        improvedSummaryClarity: false,
        improvedKeywordVisibility: true,
        noFactualDrift: true,
        noLossOfRequiredSections: true,
        noReadabilityRegression: false,
        noUnsupportedClaimsIntroduced: true,
      },
      withholdReasons: ['Readability regressed.'],
      rawScoreBefore: {
        total: 74,
        breakdown: { format: 16, structure: 15, contact: 8, keywords: 17, impact: 18 },
        issues: [],
        suggestions: [],
      },
      rawScoreAfter: {
        total: 75,
        breakdown: { format: 16, structure: 15, contact: 8, keywords: 18, impact: 18 },
        issues: [],
        suggestions: [],
      },
    })

    expect(readiness).toMatchObject({
      contractVersion: ATS_READINESS_CONTRACT_VERSION,
      scoreStatus: 'estimated_range',
      display: {
        mode: 'estimated_range',
        badgeTextPtBr: 'Estimado',
      },
    })
  })
})
