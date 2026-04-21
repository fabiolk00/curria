import { beforeEach, describe, expect, it, vi } from 'vitest'

import { recordMetricCounter } from '@/lib/observability/metric-events'
import { logInfo } from '@/lib/observability/structured-log'

import { buildBaselineAtsReadinessContract, buildAtsReadinessContractForEnhancement } from './index'
import {
  buildAtsReadinessDecisionLog,
  recordAtsReadinessCompatFieldEmission,
  recordAtsReadinessDecision,
  serializeWithholdReasons,
} from './observability'
import { ATS_READINESS_CONTRACT_VERSION } from './types'

vi.mock('@/lib/observability/structured-log', () => ({
  logInfo: vi.fn(),
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
        valid: false,
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
