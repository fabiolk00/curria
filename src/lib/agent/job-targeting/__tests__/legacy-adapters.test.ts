import { describe, expect, it } from 'vitest'

import {
  buildCoreRequirementCoverageFromAssessment,
  buildDisplayScoreFromAssessment,
  buildJobTargetingExplanationFromAssessment,
  buildLowFitWarningGateFromAssessment,
  buildTargetEvidenceFromAssessment,
  buildTargetingPlanFromAssessment,
  buildTargetRolePositioningFromAssessment,
  buildRewritePermissionsFromAssessment,
  buildSafeTargetingEmphasisFromAssessment,
} from '@/lib/agent/job-targeting/compatibility/legacy-adapters'
import type {
  JobCompatibilityAssessment,
  JobCompatibilityScoreBreakdown,
  JobCompatibilityScoreDimensionBreakdown,
  JobCompatibilityScoreDimensionId,
  ProductEvidenceGroup,
  RequirementEvidence,
} from '@/lib/agent/job-targeting/compatibility/types'
import type { TargetingPlan } from '@/types/agent'

function dimensionDetail(
  id: JobCompatibilityScoreDimensionId,
  rawScore: number,
  weight: number,
): JobCompatibilityScoreDimensionBreakdown {
  return {
    id,
    weight,
    requirementCount: 1,
    supportedCount: rawScore === 1 ? 1 : 0,
    adjacentCount: rawScore === 0.5 ? 1 : 0,
    unsupportedCount: rawScore === 0 ? 1 : 0,
    rawScore,
    weightedScore: rawScore * weight,
  }
}

function scoreBreakdown(overrides: Partial<JobCompatibilityScoreBreakdown> = {}): JobCompatibilityScoreBreakdown {
  return {
    version: 'job-compat-score-v1',
    total: 68,
    maxTotal: 100,
    adjacentDiscount: 0.5,
    dimensions: {
      skills: 80,
      experience: 55,
      education: 100,
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
    formula: {
      supportedValue: 1,
      adjacentValue: 0.5,
      unsupportedValue: 0,
    },
    audit: {
      dimensionDetails: {
        skills: dimensionDetail('skills', 0.8, 0.34),
        experience: dimensionDetail('experience', 0.55, 0.46),
        education: dimensionDetail('education', 1, 0.2),
      },
    },
    ...overrides,
  }
}

function requirement(
  overrides: Partial<RequirementEvidence> & Pick<RequirementEvidence, 'id' | 'productGroup' | 'rewritePermission'>,
): RequirementEvidence {
  const signal = overrides.extractedSignals?.[0] ?? overrides.originalRequirement ?? overrides.id
  const { id, ...rest } = overrides

  return {
    id,
    originalRequirement: signal,
    normalizedRequirement: signal.toLowerCase(),
    extractedSignals: [signal],
    kind: 'skill',
    importance: 'core',
    evidenceLevel: overrides.productGroup === 'supported'
      ? 'explicit'
      : overrides.productGroup === 'adjacent'
        ? 'strong_contextual_inference'
        : 'unsupported_gap',
    matchedResumeTerms: overrides.productGroup === 'unsupported' ? [] : [`Resume ${signal}`],
    supportingResumeSpans: overrides.productGroup === 'unsupported'
      ? []
      : [{ id: `span-${overrides.id}`, text: `Experience with ${signal}`, section: 'experience' }],
    confidence: overrides.productGroup === 'unsupported' ? 0.7 : 0.9,
    rationale: `Assessment rationale for ${signal}`,
    source: overrides.productGroup === 'supported' ? 'exact' : 'fallback',
    catalogTermIds: [],
    catalogCategoryIds: [],
    prohibitedTerms: overrides.productGroup === 'unsupported' ? [signal] : [],
    audit: {
      matcherVersion: 'test',
      precedence: ['exact'],
      catalogIds: ['test-catalog'],
      catalogVersions: { 'test-catalog': '1.0.0' },
      catalogTermIds: [],
      catalogCategoryIds: [],
    },
    ...rest,
  }
}

function assessment(overrides: Partial<JobCompatibilityAssessment> = {}): JobCompatibilityAssessment {
  const supported = requirement({
    id: 'req-supported',
    productGroup: 'supported',
    rewritePermission: 'can_claim_directly',
    extractedSignals: ['Supported requirement'],
  })
  const adjacent = requirement({
    id: 'req-adjacent',
    productGroup: 'adjacent',
    rewritePermission: 'can_bridge_carefully',
    extractedSignals: ['Adjacent requirement'],
  })
  const unsupported = requirement({
    id: 'req-unsupported',
    productGroup: 'unsupported',
    rewritePermission: 'must_not_claim',
    extractedSignals: ['Unsupported requirement'],
  })

  return {
    version: 'job-compat-assessment-v1',
    targetRole: 'Target Role',
    targetRoleConfidence: 'high',
    targetRoleSource: 'heuristic',
    requirements: [supported, adjacent, unsupported],
    supportedRequirements: [supported],
    adjacentRequirements: [adjacent],
    unsupportedRequirements: [unsupported],
    claimPolicy: {
      allowedClaims: [{
        id: 'claim-supported',
        signal: 'Supported requirement',
        permission: 'allowed',
        evidenceBasis: [{ id: 'span-supported', text: 'Experience with Supported requirement' }],
        allowedTerms: ['Supported requirement', 'Resume Supported requirement'],
        prohibitedTerms: [],
        rationale: 'Supported by assessment.',
        requirementIds: ['req-supported'],
      }],
      cautiousClaims: [{
        id: 'claim-adjacent',
        signal: 'Adjacent requirement',
        permission: 'cautious',
        verbalizationTemplate: 'Use adjacent evidence: {allowedTerms}.',
        evidenceBasis: [{ id: 'span-adjacent', text: 'Experience with Adjacent requirement' }],
        allowedTerms: ['Resume Adjacent requirement'],
        prohibitedTerms: ['Adjacent requirement'],
        rationale: 'Adjacent by assessment.',
        requirementIds: ['req-adjacent'],
      }],
      forbiddenClaims: [{
        id: 'claim-unsupported',
        signal: 'Unsupported requirement',
        permission: 'forbidden',
        evidenceBasis: [],
        allowedTerms: [],
        prohibitedTerms: ['Unsupported requirement'],
        rationale: 'Unsupported by assessment.',
        requirementIds: ['req-unsupported'],
      }],
    },
    scoreBreakdown: scoreBreakdown(),
    criticalGaps: [{
      id: 'critical-gap-unsupported',
      signal: 'Unsupported requirement',
      kind: 'skill',
      importance: 'core',
      severity: 'critical',
      rationale: 'unsupported_core_requirement',
      requirementIds: ['req-unsupported'],
      prohibitedTerms: ['Unsupported requirement'],
    }],
    reviewNeededGaps: [],
    lowFit: {
      triggered: true,
      blocking: true,
      reason: 'very_low_compatibility_score',
      riskLevel: 'high',
      reasons: ['very_low_compatibility_score'],
      thresholdAudit: {
        score: 68,
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
        allowedClaims: 1,
        cautiousClaims: 1,
        forbiddenClaims: 1,
        criticalGaps: 1,
        reviewNeededGaps: 0,
      },
    },
    ...overrides,
  }
}

function basePlan(): TargetingPlan {
  return {
    targetRole: 'Old Role',
    targetRoleConfidence: 'low',
    targetRoleSource: 'fallback',
    focusKeywords: ['existing focus'],
    mustEmphasize: ['existing emphasis'],
    shouldDeemphasize: ['legacy item'],
    missingButCannotInvent: ['legacy gap'],
    sectionStrategy: {
      summary: ['legacy summary'],
      experience: ['legacy experience'],
      skills: ['legacy skills'],
      education: ['legacy education'],
      certifications: ['legacy certifications'],
    },
  }
}

describe('legacy assessment adapters', () => {
  it('maps assessment requirements to legacy target evidence and permissions', () => {
    const targetEvidence = buildTargetEvidenceFromAssessment(assessment())

    expect(targetEvidence).toEqual([
      expect.objectContaining({
        jobSignal: 'Supported requirement',
        evidenceLevel: 'explicit',
        rewritePermission: 'can_claim_directly',
        allowedRewriteForms: expect.arrayContaining(['Supported requirement', 'Resume Supported requirement']),
      }),
      expect.objectContaining({
        jobSignal: 'Adjacent requirement',
        evidenceLevel: 'strong_contextual_inference',
        rewritePermission: 'can_bridge_carefully',
        forbiddenRewriteForms: expect.arrayContaining(['Adjacent requirement']),
      }),
      expect.objectContaining({
        jobSignal: 'Unsupported requirement',
        evidenceLevel: 'unsupported_gap',
        rewritePermission: 'must_not_claim',
        validationSeverityIfViolated: 'critical',
      }),
    ])

    expect(buildRewritePermissionsFromAssessment(assessment())).toEqual(expect.objectContaining({
      directClaimsAllowed: ['Supported requirement'],
      bridgeClaimsAllowed: [expect.objectContaining({ jobSignal: 'Adjacent requirement' })],
      forbiddenClaims: ['Unsupported requirement'],
      skillsSurfaceAllowed: ['Supported requirement'],
    }))
  })

  it('builds legacy coverage, low-fit gate, safe emphasis, and role positioning from assessment only', () => {
    const source = assessment()
    const targetEvidence = buildTargetEvidenceFromAssessment(source)
    const rewritePermissions = buildRewritePermissionsFromAssessment(source, targetEvidence)
    const coreRequirementCoverage = buildCoreRequirementCoverageFromAssessment(source)

    expect(coreRequirementCoverage).toEqual(expect.objectContaining({
      total: 3,
      supported: 1,
      unsupported: 2,
      unsupportedSignals: ['Adjacent requirement', 'Unsupported requirement'],
      topUnsupportedSignalsForDisplay: ['Unsupported requirement'],
    }))
    expect(buildLowFitWarningGateFromAssessment(source, {
      targetEvidence,
      coreRequirementCoverage,
    })).toEqual(expect.objectContaining({
      triggered: true,
      reason: 'very_low_match_score',
      matchScore: 68,
      riskLevel: 'high',
      coreRequirementCoverage,
    }))
    expect(buildSafeTargetingEmphasisFromAssessment(source, {
      targetEvidence,
      rewritePermissions,
    })).toEqual(expect.objectContaining({
      safeDirectEmphasis: expect.arrayContaining(['Supported requirement']),
      forbiddenDirectClaims: expect.arrayContaining(['Unsupported requirement']),
      cautiousBridgeEmphasis: [expect.objectContaining({ jobSignal: 'Adjacent requirement' })],
    }))
    expect(buildTargetRolePositioningFromAssessment(source, {
      targetEvidence,
      coreRequirementCoverage,
    })).toEqual(expect.objectContaining({
      targetRole: 'Target Role',
      permission: 'must_not_claim_target_role',
      forbiddenRoleClaims: expect.arrayContaining(['Target Role']),
    }))
  })

  it('preserves the legacy TargetingPlan and explanation shapes with deterministic score fields', () => {
    const source = assessment()
    const plan = buildTargetingPlanFromAssessment(source, { basePlan: basePlan() })
    const explanation = buildJobTargetingExplanationFromAssessment(source, {
      generatedAt: '2026-05-02T12:30:00.000Z',
    })

    expect(plan).toEqual(expect.objectContaining({
      targetRole: 'Target Role',
      targetRoleConfidence: 'high',
      targetRoleSource: 'heuristic',
      focusKeywords: ['existing focus'],
      mustEmphasize: ['existing emphasis'],
      targetEvidence: expect.arrayContaining([
        expect.objectContaining({ jobSignal: 'Supported requirement' }),
      ]),
      lowFitWarningGate: expect.objectContaining({ matchScore: 68 }),
    }))
    expect(buildDisplayScoreFromAssessment(source)).toEqual({
      total: 68,
      maxTotal: 100,
      items: [
        { id: 'skills', label: 'Habilidades', score: 80, max: 100 },
        { id: 'experience', label: 'Experiência', score: 55, max: 100 },
        { id: 'education', label: 'Formação', score: 100, max: 100 },
      ],
      criticalGaps: ['Unsupported requirement'],
    })
    expect(explanation).toEqual(expect.objectContaining({
      targetRole: 'Target Role',
      targetRoleConfidence: 'high',
      generatedAt: '2026-05-02T12:30:00.000Z',
      source: 'job_targeting',
      version: 1,
      scoreBreakdown: expect.objectContaining({
        total: 68,
        items: expect.arrayContaining([
          expect.objectContaining({ id: 'skills', score: 80 }),
        ]),
      }),
      targetRecommendations: [expect.objectContaining({
        jobRequirement: 'Unsupported requirement',
        mustNotInvent: true,
      })],
    }))
  })
})
