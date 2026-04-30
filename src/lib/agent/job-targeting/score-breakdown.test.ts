import { describe, expect, it } from 'vitest'

import { buildJobTargetingScoreBreakdown } from '@/lib/agent/job-targeting/score-breakdown'
import type { CoreRequirement, TargetEvidence } from '@/types/agent'
import type { CVState } from '@/types/cv'

const cvState: CVState = {
  fullName: 'Ana Silva',
  email: 'ana@example.com',
  phone: '555-0100',
  summary: 'Analista de dados com foco em BI.',
  experience: [{
    title: 'Analista de BI',
    company: 'Acme',
    startDate: '2022',
    endDate: 'present',
    bullets: ['Construí dashboards executivos em Power BI.'],
  }],
  skills: ['SQL', 'Power BI', 'Excel'],
  education: [{
    degree: 'Bacharelado em Administração',
    institution: 'Universidade ABC',
    year: '2020',
  }],
  certifications: [],
}

function requirement(overrides: Partial<CoreRequirement>): CoreRequirement {
  return {
    signal: 'Power BI',
    importance: 'core',
    requirementKind: 'required',
    evidenceLevel: 'unsupported_gap',
    rewritePermission: 'must_not_claim',
    ...overrides,
  }
}

function evidence(overrides: Partial<TargetEvidence>): TargetEvidence {
  return {
    jobSignal: 'Power BI',
    canonicalSignal: 'power bi',
    evidenceLevel: 'explicit',
    rewritePermission: 'can_claim_directly',
    matchedResumeTerms: ['Power BI'],
    supportingResumeSpans: ['Power BI'],
    rationale: 'Supported by skills.',
    confidence: 0.95,
    allowedRewriteForms: ['Power BI'],
    forbiddenRewriteForms: [],
    validationSeverityIfViolated: 'none',
    ...overrides,
  }
}

describe('buildJobTargetingScoreBreakdown', () => {
  it('builds 1-100 scores for skills, experience, and education', () => {
    const breakdown = buildJobTargetingScoreBreakdown({
      cvState,
      coreRequirements: [
        requirement({ signal: 'Power BI', evidenceLevel: 'explicit', rewritePermission: 'can_claim_directly' }),
        requirement({ signal: 'Gestão de contas estratégicas e relacionamento executivo com clientes' }),
        requirement({ signal: 'Formação superior completa', evidenceLevel: 'explicit', rewritePermission: 'can_claim_directly' }),
      ],
      preferredRequirements: [],
      targetEvidence: [
        evidence({ jobSignal: 'Power BI', canonicalSignal: 'power bi' }),
        evidence({
          jobSignal: 'Formação superior completa',
          canonicalSignal: 'formação superior completa',
          matchedResumeTerms: ['Bacharelado em Administração'],
          supportingResumeSpans: ['Bacharelado em Administração'],
          allowedRewriteForms: ['Formação superior completa'],
        }),
      ],
      criticalGapSignals: ['Gestão de contas estratégicas e relacionamento executivo com clientes'],
    })

    expect(breakdown.maxTotal).toBe(100)
    expect(breakdown.items.map((item) => item.label)).toEqual(['Habilidades', 'Experiência', 'Formação'])
    expect(breakdown.items.every((item) => item.score >= 1 && item.score <= 100)).toBe(true)
    expect(breakdown.criticalGaps).toEqual(['Gestão de contas estratégicas e relacionamento executivo com clientes'])
  })

  it('cleans verbose critical gap labels before display', () => {
    const breakdown = buildJobTargetingScoreBreakdown({
      cvState,
      coreRequirements: [requirement({
        signal: 'Também será responsável por identificar oportunidades de crescimento nas contas e estruturar propostas comerciais',
      })],
      preferredRequirements: [],
      targetEvidence: [],
      criticalGapSignals: ['Tem experiência com expansão de contas , identificando e convertendo novas oportunidades de negócio'],
    })

    expect(breakdown.criticalGaps).toEqual([
      'Expansão de contas, identificando e convertendo novas oportunidades de negócio',
    ])
  })
})
