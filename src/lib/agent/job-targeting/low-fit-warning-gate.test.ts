import { describe, expect, it } from 'vitest'

import { applyLowFitWarningGateToValidation, buildLowFitWarningGate } from '@/lib/agent/job-targeting/low-fit-warning-gate'
import type { LowFitWarningGate, RewriteValidationResult, TargetEvidence } from '@/types/agent'

function buildValidation(overrides: Partial<RewriteValidationResult> = {}): RewriteValidationResult {
  return {
    blocked: false,
    valid: true,
    hardIssues: [],
    softWarnings: [],
    issues: [],
    ...overrides,
  }
}

function buildLowFitGate(overrides: Partial<LowFitWarningGate> = {}): LowFitWarningGate {
  return {
    triggered: true,
    reason: 'high_risk_off_target',
    matchScore: 32,
    riskLevel: 'high',
    familyDistance: 'distant',
    explicitEvidenceCount: 1,
    unsupportedGapCount: 10,
    unsupportedGapRatio: 0.9,
    explicitEvidenceRatio: 0.08,
    coreRequirementCoverage: {
      total: 6,
      supported: 1,
      unsupported: 5,
      unsupportedSignals: ['Java', 'Spring Boot', 'Docker'],
    },
    ...overrides,
  }
}

describe('low-fit warning gate', () => {
  it('promotes low-fit soft warnings including seniority inflation into a recoverable hard block', () => {
    const validation = applyLowFitWarningGateToValidation({
      validation: buildValidation({
        softWarnings: [
          {
            severity: 'medium',
            section: 'summary',
            issueType: 'seniority_inflation',
            message: 'O resumo inflou senioridade sem evidência real.',
          },
        ],
        issues: [
          {
            severity: 'medium',
            section: 'summary',
            issueType: 'seniority_inflation',
            message: 'O resumo inflou senioridade sem evidência real.',
          },
        ],
      }),
      lowFitWarningGate: buildLowFitGate(),
      targetRole: 'Desenvolvedor Java',
    })

    expect(validation.blocked).toBe(true)
    expect(validation.recoverable).toBe(true)
    expect(validation.hardIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        issueType: 'seniority_inflation',
        severity: 'high',
      }),
    ]))
    expect(validation.promotedWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        issueType: 'seniority_inflation',
      }),
    ]))
  })

  it('creates a synthetic low-fit issue when no promotable warning exists', () => {
    const validation = applyLowFitWarningGateToValidation({
      validation: buildValidation(),
      lowFitWarningGate: buildLowFitGate(),
      targetRole: 'Desenvolvedor Java',
      targetRolePositioning: {
        targetRole: 'Desenvolvedor Java',
        permission: 'must_not_claim_target_role',
        reason: 'career_fit_high_risk',
        safeRolePositioning: 'Profissional com experiência em BI, SQL e APIs REST.',
        forbiddenRoleClaims: ['Desenvolvedor Java'],
      },
    })

    expect(validation.blocked).toBe(true)
    expect(validation.recoverable).toBe(true)
    expect(validation.hardIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        issueType: 'low_fit_target_role',
        userFacingTitle: 'Esta vaga parece muito distante do seu currículo atual',
      }),
    ]))
  })

  it('triggers for very low match score with mostly unsupported evidence', () => {
    const targetEvidence: TargetEvidence[] = [
      {
        jobSignal: 'Java',
        canonicalSignal: 'Java',
        evidenceLevel: 'unsupported_gap',
        rewritePermission: 'must_not_claim',
        matchedResumeTerms: [],
        supportingResumeSpans: [],
        rationale: 'Sem evidência real.',
        confidence: 0.98,
        allowedRewriteForms: [],
        forbiddenRewriteForms: ['Java'],
        validationSeverityIfViolated: 'critical',
      },
      {
        jobSignal: 'Git',
        canonicalSignal: 'Git',
        evidenceLevel: 'explicit',
        rewritePermission: 'can_claim_directly',
        matchedResumeTerms: ['Git'],
        supportingResumeSpans: ['Git'],
        rationale: 'Existe no currículo.',
        confidence: 1,
        allowedRewriteForms: ['Git'],
        forbiddenRewriteForms: [],
        validationSeverityIfViolated: 'none',
      },
    ]

    const gate = buildLowFitWarningGate({
      matchScore: 32,
      careerFitEvaluation: {
        riskLevel: 'high',
        signals: {
          matchScore: 32,
          missingSkillsCount: 12,
          familyDistance: 'distant',
        },
      },
      targetEvidence,
      targetRolePositioning: {
        targetRole: 'Desenvolvedor Java',
        permission: 'must_not_claim_target_role',
        reason: 'career_fit_high_risk',
        safeRolePositioning: 'Profissional com experiência em BI, SQL e APIs REST.',
        forbiddenRoleClaims: ['Desenvolvedor Java'],
      },
      coreRequirementCoverage: {
        total: 6,
        supported: 1,
        unsupported: 5,
        unsupportedSignals: ['Java', 'Spring Boot', 'Docker'],
      },
    })

    expect(gate.triggered).toBe(true)
    expect(gate.reason).toBe('very_low_match_score')
  })
})
