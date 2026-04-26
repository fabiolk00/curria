import { beforeEach, describe, expect, it, vi } from 'vitest'

import { recordMetricCounter } from '@/lib/observability/metric-events'
import { logInfo, logWarn } from '@/lib/observability/structured-log'

import { buildBaselineAtsReadinessContract, buildAtsReadinessContractForEnhancement } from './index'
import {
  buildAtsReadinessDecisionLog,
  buildAtsSummaryClarityOutcomeLog,
  recordAtsReadinessCompatFieldEmission,
  recordAtsReadinessDecision,
  recordAtsSummaryClarityOutcome,
  serializeWithholdReasons,
} from './observability'
import { ATS_READINESS_CONTRACT_VERSION } from './types'

vi.mock('@/lib/observability/structured-log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('@/lib/observability/metric-events', () => ({
  recordMetricCounter: vi.fn(),
}))

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

function buildHealthyEnhancementContract() {
  return buildAtsReadinessContractForEnhancement({
    originalCvState: {
      ...BASE_CV,
      summary: 'Analista de dados com experiência em SQL, BI e apoio a decisoes de negocio.',
    },
    optimizedCvState: {
      ...BASE_CV,
      summary: 'Analista de dados com foco em SQL, Power BI e indicadores executivos para decisoes de negocio.',
      experience: [{
        ...BASE_CV.experience[0],
        bullets: ['Implementei dashboards em Power BI e reduzi o tempo de reporte em 25%.'],
      }],
      skills: ['SQL', 'Power BI', 'Excel', 'ETL'],
    },
    rewriteValidation: cleanRewriteValidation,
    optimizationSummary: {
      changedSections: ['summary', 'experience', 'skills'],
      notes: ['Resumo e stack ficaram mais claros.'],
      keywordCoverageImprovement: ['SQL', 'Power BI', 'ETL'],
    },
  })
}

function buildSummaryClarityFailContract() {
  return buildAtsReadinessContractForEnhancement({
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
}

describe('ATS readiness observability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('serializes withhold reasons deterministically', () => {
    expect(serializeWithholdReasons(['b', 'a'])).toBe('["b","a"]')
  })

  it('builds floor and cap flags correctly for final decisions', () => {
    const baseline = buildBaselineAtsReadinessContract({ cvState: BASE_CV })
    const contract = {
      ...baseline,
      rawInternalScoreAfter: 99,
      displayedReadinessScoreBefore: 90,
      displayedReadinessScoreAfter: 95,
      displayedReadinessScoreCurrent: 95,
      display: {
        ...baseline.display,
        mode: 'exact' as const,
        scoreStatus: 'final' as const,
        exactScore: 95,
        formattedScorePtBr: '95',
      },
      rawScoreAfter: {
        ...baseline.rawScoreAfter,
        total: 99,
      },
    }

    const decision = buildAtsReadinessDecisionLog(contract)
    expect(decision.appliedCap95).toBe(true)
    expect(decision.appliedFloor89).toBe(false)
  })

  it('records estimated ranges and withheld-to-range conversion deterministically', () => {
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
    vi.mocked(logInfo).mockClear()
    vi.mocked(recordMetricCounter).mockClear()

    recordAtsReadinessDecision(contract)

    expect(logInfo).toHaveBeenCalledWith('ats_readiness.decision', expect.objectContaining({
      scoreStatus: 'estimated_range',
      displayMode: 'estimated_range',
      estimatedRangeMin: expect.any(Number),
      estimatedRangeMax: expect.any(Number),
      withheldConvertedToRange: true,
    }))
    expect(recordMetricCounter).toHaveBeenCalledWith('architecture.ats_readiness.estimated_range', expect.any(Object))
    expect(recordMetricCounter).toHaveBeenCalledWith('architecture.ats_readiness.withheld_converted_to_range', expect.any(Object))
  })

  it('records a structured scoring decision payload and metrics', () => {
    const contract = buildBaselineAtsReadinessContract({ cvState: BASE_CV })
    vi.mocked(logInfo).mockClear()
    vi.mocked(recordMetricCounter).mockClear()

    recordAtsReadinessDecision(contract)

    expect(logInfo).toHaveBeenCalledWith('ats_readiness.decision', expect.objectContaining({
      contractVersion: ATS_READINESS_CONTRACT_VERSION,
      workflowMode: 'ats_enhancement',
      scoreStatus: 'final',
      displayMode: 'exact',
      confidence: expect.any(String),
      withholdReasons: '[]',
      gateImprovedSummaryClarity: false,
    }))
    expect(recordMetricCounter).toHaveBeenCalledWith('architecture.ats_readiness.finalized', expect.objectContaining({
      contractVersion: ATS_READINESS_CONTRACT_VERSION,
    }))
  })

  it('builds a healthy summary clarity outcome payload without recovery', () => {
    const outcome = buildAtsSummaryClarityOutcomeLog({
      sessionId: 'sess_healthy',
      userId: 'usr_healthy',
      summaryRecoveryKind: null,
      summaryWasTouchedByRewrite: true,
      contract: buildHealthyEnhancementContract(),
    })

    expect(outcome).toMatchObject({
      sessionId: 'sess_healthy',
      userId: 'usr_healthy',
      contractVersion: ATS_READINESS_CONTRACT_VERSION,
      workflowMode: 'ats_enhancement',
      scoreStatus: 'final',
      estimatedRangeOutcome: false,
      usedExactScore: true,
      summaryValidationRecovered: false,
      summaryRecoveryKind: null,
      summaryRecoveryWasSmartRepair: false,
      summaryWasTouchedByRewrite: true,
      gateImprovedSummaryClarity: true,
      summaryClarityGateFailed: false,
      summaryRepairThenClarityFail: false,
      withheldForSummaryClarity: false,
    })
  })

  it('marks smart-repair summary recovery that still passes clarity', () => {
    const outcome = buildAtsSummaryClarityOutcomeLog({
      sessionId: 'sess_recovered_pass',
      summaryRecoveryKind: 'smart_repair',
      summaryWasTouchedByRewrite: true,
      contract: buildHealthyEnhancementContract(),
    })

    expect(outcome.summaryValidationRecovered).toBe(true)
    expect(outcome.summaryRecoveryWasSmartRepair).toBe(true)
    expect(outcome.summaryClarityGateFailed).toBe(false)
    expect(outcome.summaryRepairThenClarityFail).toBe(false)
    expect(outcome.estimatedRangeOutcome).toBe(false)
  })

  it('marks smart-repair summary recovery that still fails clarity and falls back to estimated range', () => {
    const outcome = buildAtsSummaryClarityOutcomeLog({
      sessionId: 'sess_recovered_fail',
      summaryRecoveryKind: 'smart_repair',
      summaryWasTouchedByRewrite: true,
      contract: buildSummaryClarityFailContract(),
    })

    expect(outcome.summaryValidationRecovered).toBe(true)
    expect(outcome.summaryRecoveryWasSmartRepair).toBe(true)
    expect(outcome.summaryClarityGateFailed).toBe(true)
    expect(outcome.summaryRepairThenClarityFail).toBe(true)
    expect(outcome.withheldForSummaryClarity).toBe(true)
    expect(outcome.estimatedRangeOutcome).toBe(true)
    expect(outcome.usedExactScore).toBe(false)
  })

  it('keeps summary recovery false when clarity fails without a summary recovery path', () => {
    const outcome = buildAtsSummaryClarityOutcomeLog({
      sessionId: 'sess_fail_no_recovery',
      summaryRecoveryKind: null,
      summaryWasTouchedByRewrite: true,
      contract: buildSummaryClarityFailContract(),
    })

    expect(outcome.summaryValidationRecovered).toBe(false)
    expect(outcome.summaryClarityGateFailed).toBe(true)
    expect(outcome.summaryRepairThenClarityFail).toBe(false)
    expect(outcome.estimatedRangeOutcome).toBe(true)
  })

  it('does not incorrectly mark non-summary recoveries as summary recovery', () => {
    const outcome = buildAtsSummaryClarityOutcomeLog({
      sessionId: 'sess_non_summary',
      summaryRecoveryKind: null,
      summaryWasTouchedByRewrite: false,
      contract: buildHealthyEnhancementContract(),
    })

    expect(outcome.summaryValidationRecovered).toBe(false)
    expect(outcome.summaryRecoveryKind).toBeNull()
    expect(outcome.summaryRecoveryWasSmartRepair).toBe(false)
    expect(outcome.summaryWasTouchedByRewrite).toBe(false)
  })

  it('keeps smart-repair-specific failure false for non-smart-repair summary recoveries', () => {
    const outcome = buildAtsSummaryClarityOutcomeLog({
      sessionId: 'sess_conservative',
      summaryRecoveryKind: 'conservative_fallback',
      summaryWasTouchedByRewrite: true,
      contract: buildSummaryClarityFailContract(),
    })

    expect(outcome.summaryValidationRecovered).toBe(true)
    expect(outcome.summaryRecoveryWasSmartRepair).toBe(false)
    expect(outcome.summaryClarityGateFailed).toBe(true)
    expect(outcome.summaryRepairThenClarityFail).toBe(false)
  })

  it('records the summary clarity outcome event with stable explicit fields', () => {
    vi.mocked(logInfo).mockClear()
    vi.mocked(logWarn).mockClear()

    recordAtsSummaryClarityOutcome({
      sessionId: 'sess_logged',
      userId: 'usr_logged',
      summaryRecoveryKind: 'smart_repair',
      summaryWasTouchedByRewrite: true,
      contract: buildSummaryClarityFailContract(),
    })

    expect(logWarn).toHaveBeenCalledWith(
      'agent.ats_enhancement.summary_clarity_outcome',
      expect.objectContaining({
        sessionId: 'sess_logged',
        userId: 'usr_logged',
        contractVersion: ATS_READINESS_CONTRACT_VERSION,
        workflowMode: 'ats_enhancement',
        scoreStatus: 'estimated_range',
        estimatedRangeOutcome: true,
        usedExactScore: false,
        summaryValidationRecovered: true,
        summaryRecoveryKind: 'smart_repair',
        summaryRecoveryWasSmartRepair: true,
        gateImprovedSummaryClarity: false,
        summaryClarityGateFailed: true,
        summaryRepairThenClarityFail: true,
        withheldForSummaryClarity: true,
        withholdReasons: expect.any(String),
        withholdReasonCount: expect.any(Number),
      }),
    )
    expect(logInfo).not.toHaveBeenCalledWith(
      'agent.ats_enhancement.summary_clarity_outcome',
      expect.any(Object),
    )
  })

  it('records the summary clarity outcome at info for healthy and non-problematic paths', () => {
    vi.mocked(logInfo).mockClear()
    vi.mocked(logWarn).mockClear()

    recordAtsSummaryClarityOutcome({
      sessionId: 'sess_info',
      userId: 'usr_info',
      summaryRecoveryKind: 'conservative_fallback',
      summaryWasTouchedByRewrite: true,
      contract: buildHealthyEnhancementContract(),
    })

    expect(logInfo).toHaveBeenCalledWith(
      'agent.ats_enhancement.summary_clarity_outcome',
      expect.objectContaining({
        sessionId: 'sess_info',
        userId: 'usr_info',
        summaryValidationRecovered: true,
        summaryRecoveryKind: 'conservative_fallback',
        summaryRecoveryWasSmartRepair: false,
        summaryRepairThenClarityFail: false,
      }),
    )
    expect(logWarn).not.toHaveBeenCalledWith(
      'agent.ats_enhancement.summary_clarity_outcome',
      expect.any(Object),
    )
  })

  it('records compatibility-field emission for legacy atsScore seams', () => {
    recordAtsReadinessCompatFieldEmission({
      surface: 'session_response',
      workflowMode: 'ats_enhancement',
      hasCanonicalReadiness: true,
      contractVersion: ATS_READINESS_CONTRACT_VERSION,
    })

    expect(logInfo).toHaveBeenCalledWith('ats_readiness.compat_field_emitted', expect.objectContaining({
      surface: 'session_response',
      workflowMode: 'ats_enhancement',
      hasCanonicalReadiness: true,
      contractVersion: ATS_READINESS_CONTRACT_VERSION,
    }))
    expect(recordMetricCounter).toHaveBeenCalledWith(
      'architecture.ats_readiness.compat_session_ats_score_emitted',
      expect.objectContaining({
        contractVersion: ATS_READINESS_CONTRACT_VERSION,
        surface: 'session_response',
      }),
    )
  })
})
