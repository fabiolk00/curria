import { describe, expect, it } from 'vitest'

import {
  buildJobTargetingScoreBreakdown,
  buildJobTargetingScoreBreakdownFromAssessment,
  buildJobTargetingScoreBreakdownFromPlan,
} from '@/lib/agent/job-targeting/score-breakdown'
import type { JobCompatibilityAssessment } from '@/lib/agent/job-targeting/compatibility/types'
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

function assessment(overrides: Partial<JobCompatibilityAssessment> = {}): JobCompatibilityAssessment {
  return {
    version: 'job-compat-assessment-v1',
    targetRole: 'Target Role',
    targetRoleConfidence: 'high',
    targetRoleSource: 'heuristic',
    requirements: [],
    supportedRequirements: [],
    adjacentRequirements: [],
    unsupportedRequirements: [],
    claimPolicy: {
      allowedClaims: [],
      cautiousClaims: [],
      forbiddenClaims: [],
    },
    scoreBreakdown: {
      version: 'job-compat-score-v1',
      total: 42,
      maxTotal: 100,
      adjacentDiscount: 0.5,
      dimensions: {
        skills: 30,
        experience: 50,
        education: 70,
      },
      counts: {
        total: 3,
        supported: 1,
        adjacent: 1,
        unsupported: 1,
      },
      weights: {
        skills: 0.34,
        experience: 0.46,
        education: 0.2,
      },
      activeWeights: {
        skills: 0.34,
        experience: 0.46,
        education: 0.2,
      },
      warnings: [],
      formula: {
        supportedValue: 1,
        adjacentValue: 0.5,
        unsupportedValue: 0,
        confidenceMultiplier: true,
      },
      audit: {
        dimensionDetails: {
          skills: {
            id: 'skills',
            weight: 0.34,
            requirementCount: 1,
            supportedCount: 0,
            adjacentCount: 0,
            unsupportedCount: 1,
            rawScore: 0,
            weightedScore: 0,
          },
          experience: {
            id: 'experience',
            weight: 0.46,
            requirementCount: 1,
            supportedCount: 0,
            adjacentCount: 1,
            unsupportedCount: 0,
            rawScore: 0.5,
            weightedScore: 0.23,
          },
          education: {
            id: 'education',
            weight: 0.2,
            requirementCount: 1,
            supportedCount: 1,
            adjacentCount: 0,
            unsupportedCount: 0,
            rawScore: 1,
            weightedScore: 0.2,
          },
        },
      },
    },
    criticalGaps: [{
      id: 'gap-unsupported',
      signal: 'Unsupported requirement',
      kind: 'skill',
      importance: 'core',
      severity: 'critical',
      rationale: 'No direct evidence.',
      requirementIds: ['req-unsupported'],
    }],
    reviewNeededGaps: [],
    lowFit: {
      triggered: false,
      blocking: false,
      riskLevel: 'medium',
      reasons: [],
      thresholdAudit: {
        score: 42,
        minimumScore: 25,
        unsupportedCoreCount: 1,
        totalCoreCount: 3,
        unsupportedCoreRatio: 1 / 3,
        supportedOrAdjacentCount: 2,
      },
    },
    catalog: {
      catalogIds: ['test-catalog'],
      catalogVersions: { 'test-catalog': '1.0.0' },
    },
    audit: {
      generatedAt: '2026-05-02T12:00:00.000Z',
      assessmentVersion: 'job-compat-assessment-v1',
      requirementExtractionVersion: 'test',
      evidenceExtractionVersion: 'test',
      matcherVersion: 'test',
      claimPolicyVersion: 'job-compat-claim-policy-v1',
      scoreVersion: 'job-compat-score-v1',
      counters: {
        requirements: 3,
        resumeEvidence: 2,
        supported: 1,
        adjacent: 1,
        unsupported: 1,
        allowedClaims: 0,
        cautiousClaims: 0,
        forbiddenClaims: 0,
        criticalGaps: 1,
        reviewNeededGaps: 0,
      },
      warnings: [],
    },
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

  it('uses assessment-derived deterministic display score when an assessment is present', () => {
    const source = assessment()

    expect(buildJobTargetingScoreBreakdownFromAssessment(source)).toMatchObject({
      total: 42,
      technicalScore: 42,
      displayScore: 42,
      maxTotal: 100,
      items: [
        { id: 'skills', label: 'Habilidades', score: 30, max: 100 },
        { id: 'experience', label: 'Experiência', score: 50, max: 100 },
        { id: 'education', label: 'Formação', score: 70, max: 100 },
      ],
      criticalGaps: ['Unsupported requirement'],
      gapPresentation: {
        criticalGroups: [{
          title: 'Responsabilidades-chave não evidenciadas',
          items: ['Unsupported requirement'],
        }],
        reviewNeededGroups: [],
      },
    })

    expect(buildJobTargetingScoreBreakdownFromPlan({
      cvState,
      jobCompatibilityAssessment: source,
      targetingPlan: {
        targetRole: 'Legacy Role',
        targetRoleConfidence: 'high',
        targetRoleSource: 'heuristic',
        focusKeywords: [],
        mustEmphasize: [],
        shouldDeemphasize: [],
        missingButCannotInvent: [],
        coreRequirementCoverage: {
          requirements: [
            requirement({
              signal: 'Legacy supported requirement',
              evidenceLevel: 'explicit',
              rewritePermission: 'can_claim_directly',
            }),
          ],
          total: 1,
          supported: 1,
          unsupported: 0,
          unsupportedSignals: [],
          topUnsupportedSignalsForDisplay: [],
        },
        sectionStrategy: {
          summary: [],
          experience: [],
          skills: [],
          education: [],
          certifications: [],
        },
      },
    }).total).toBe(42)
  })
})
