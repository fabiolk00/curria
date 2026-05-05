import { describe, expect, it } from 'vitest'

import {
  buildTargetRecommendations,
  buildTargetRecommendationsFromAssessment,
} from '@/lib/agent/job-targeting/target-recommendations'
import type { JobCompatibilityAssessment } from '@/lib/agent/job-targeting/compatibility/types'
import type { CoreRequirement } from '@/types/agent'

function buildRequirement(overrides: Partial<CoreRequirement>): CoreRequirement {
  return {
    signal: 'DAX',
    importance: 'core',
    requirementKind: 'required',
    evidenceLevel: 'unsupported_gap',
    rewritePermission: 'must_not_claim',
    ...overrides,
  }
}

function buildAssessment(overrides: Partial<JobCompatibilityAssessment> = {}): JobCompatibilityAssessment {
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
      total: 51,
      maxTotal: 100,
      adjacentDiscount: 0.5,
      dimensions: {
        skills: 40,
        experience: 55,
        education: 70,
      },
      counts: {
        total: 2,
        supported: 1,
        adjacent: 0,
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
            supportedCount: 1,
            adjacentCount: 0,
            unsupportedCount: 0,
            rawScore: 1,
            weightedScore: 0.46,
          },
          education: {
            id: 'education',
            weight: 0.2,
            requirementCount: 0,
            supportedCount: 0,
            adjacentCount: 0,
            unsupportedCount: 0,
            rawScore: 0,
            weightedScore: 0,
          },
        },
      },
    },
    criticalGaps: [{
      id: 'gap-unsupported',
      signal: 'Unsupported operating requirement',
      kind: 'responsibility',
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
        score: 51,
        minimumScore: 25,
        unsupportedCoreCount: 1,
        totalCoreCount: 2,
        unsupportedCoreRatio: 0.5,
        supportedOrAdjacentCount: 1,
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
        requirements: 2,
        resumeEvidence: 1,
        supported: 1,
        adjacent: 0,
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

describe('buildTargetRecommendations', () => {
  it('builds assessment-derived recommendations from critical gaps', () => {
    const recommendations = buildTargetRecommendationsFromAssessment(buildAssessment())

    expect(recommendations).toEqual([
      expect.objectContaining({
        id: 'assessment-gap-unsupported',
        priority: 'high',
        jobRequirement: 'Unsupported operating requirement',
        mustNotInvent: true,
        relatedEvidenceLevel: 'unsupported_gap',
      }),
    ])
    expect(recommendations[0].suggestedUserAction).toMatch(/apenas se/i)
  })

  it('creates a conservative DAX recommendation without catalog adjacency', () => {
    const recommendations = buildTargetRecommendations({
      targetRole: 'Analista de BI',
      coreRequirements: [buildRequirement({ signal: 'DAX' })],
      preferredRequirements: [],
      supportedSignals: ['SQL'],
      adjacentSignals: ['Power BI', 'dashboards'],
      resumeSkillSignals: ['Power BI', 'SQL'],
    })

    expect(recommendations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'missing_explicit_skill',
        jobRequirement: 'DAX',
        mustNotInvent: true,
      }),
    ]))
    expect(recommendations[0].suggestedUserAction).toMatch(/somente se/i)
    expect(recommendations[0].suggestedUserAction).toMatch(/deixe fora/i)
    expect(recommendations[0].currentEvidence).toEqual([])
  })

  it('does not use direct-order wording that would tell the user to invent a skill', () => {
    const [recommendation] = buildTargetRecommendations({
      coreRequirements: [buildRequirement({ signal: 'DAX' })],
      preferredRequirements: [],
      supportedSignals: ['SQL'],
      adjacentSignals: ['Power BI', 'dashboards'],
      resumeSkillSignals: ['Power BI', 'SQL'],
    })

    expect(recommendation.suggestedUserAction).not.toMatch(/^Adicione DAX/i)
    expect(recommendation.suggestedUserAction).not.toMatch(/^Coloque DAX/i)
    expect(recommendation.suggestedUserAction).toMatch(/Caso contr[aá]rio|fora/i)
  })

  it('normalizes verbose job requirement fragments into concise labels and copy', () => {
    const [recommendation] = buildTargetRecommendations({
      coreRequirements: [
        buildRequirement({
          signal: 'Também será responsável por identificar oportunidades de crescimento nas contas e estruturar propostas comerciais',
        }),
      ],
      preferredRequirements: [],
      supportedSignals: [],
      adjacentSignals: [],
      resumeSkillSignals: [],
    })

    expect(recommendation.jobRequirement).toBe('Identificação de oportunidades de crescimento nas contas e estruturação de propostas comerciais')
    expect(recommendation.suggestedUserAction).not.toMatch(/A vaga pede/i)
    expect(recommendation.suggestedUserAction).not.toContain('Também será responsável')
    expect(recommendation.safeExample).toBe('Se for verdadeiro: cite atividade, contexto e resultado real ligados a esse requisito.')
  })

  it('classifies generic core platform requirements as missing tooling detail', () => {
    const [recommendation] = buildTargetRecommendations({
      coreRequirements: [
        buildRequirement({
          signal: 'plataforma de integracao operacional',
          requirementKind: 'required',
        }),
      ],
      preferredRequirements: [],
      supportedSignals: [],
      adjacentSignals: [],
      resumeSkillSignals: [],
    })

    expect(recommendation).toEqual(expect.objectContaining({
      kind: 'missing_tooling_detail',
      jobRequirement: 'Plataforma de integracao operacional',
    }))
  })

  it('deduplicates narrower requirements covered by broader financial-accountability gaps', () => {
    const recommendations = buildTargetRecommendations({
      coreRequirements: [
        buildRequirement({ signal: 'Forecast e budget' }),
        buildRequirement({ signal: 'P&L, margem, faturamento, forecast e budget' }),
      ],
      preferredRequirements: [],
      supportedSignals: [],
      adjacentSignals: [],
      resumeSkillSignals: [],
    })

    expect(recommendations.map((recommendation) => recommendation.jobRequirement)).toEqual([
      'P&L, margem, faturamento, forecast e budget',
    ])
  })

  it('skips requirements that are already explicitly supported', () => {
    const recommendations = buildTargetRecommendations({
      coreRequirements: [
        buildRequirement({
          signal: 'SQL',
          evidenceLevel: 'explicit',
          rewritePermission: 'can_claim_directly',
        }),
      ],
      preferredRequirements: [],
      supportedSignals: ['SQL'],
      adjacentSignals: [],
      resumeSkillSignals: ['SQL'],
    })

    expect(recommendations).toEqual([])
  })
})
