import { describe, expect, it } from 'vitest'

import { buildTargetRolePositioning } from '@/lib/agent/job-targeting/recoverable-validation'
import type { TargetEvidence } from '@/types/agent'

describe('buildTargetRolePositioning', () => {
  it('uses proportional role positioning when match is high and core coverage is partial', () => {
    const targetEvidence: TargetEvidence[] = [
      {
        jobSignal: 'SQL',
        canonicalSignal: 'SQL',
        evidenceLevel: 'explicit',
        rewritePermission: 'can_claim_directly',
        matchedResumeTerms: ['SQL'],
        supportingResumeSpans: ['SQL'],
        rationale: 'Evidencia explicita.',
        confidence: 1,
        allowedRewriteForms: ['SQL'],
        forbiddenRewriteForms: [],
        validationSeverityIfViolated: 'none',
      },
      {
        jobSignal: 'Dashboards',
        canonicalSignal: 'Dashboards',
        evidenceLevel: 'explicit',
        rewritePermission: 'can_claim_directly',
        matchedResumeTerms: ['Dashboards'],
        supportingResumeSpans: ['dashboards'],
        rationale: 'Evidencia explicita.',
        confidence: 1,
        allowedRewriteForms: ['Dashboards'],
        forbiddenRewriteForms: [],
        validationSeverityIfViolated: 'none',
      },
    ]

    const positioning = buildTargetRolePositioning({
      targetRole: 'Analista De BI',
      targetEvidence,
      directClaimsAllowed: ['SQL', 'Dashboards'],
      careerFitEvaluation: {
        riskLevel: 'high',
        needsExplicitConfirmation: true,
        summary: 'Distancia contraditoria com match alto.',
        reasons: [],
        riskPoints: 7,
        assessedAt: '2026-04-28T00:00:00.000Z',
        signals: {
          matchScore: 79,
          familyDistance: 'distant',
          seniorityGapMajor: false,
        },
      },
      matchScore: 79,
      targetRoleConfidence: 'high',
      coreRequirementCoverage: {
        supported: 4,
        unsupported: 19,
      },
    })

    expect(positioning.permission).not.toBe('must_not_claim_target_role')
    expect(positioning.permission).toBe('can_bridge_to_target_role')
    expect(positioning.reason).toBe('partial_fit_supported_by_core_evidence')
  })
})
