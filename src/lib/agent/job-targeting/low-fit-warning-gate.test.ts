import { describe, expect, it } from 'vitest'

import {
  applyLowFitWarningGateToValidation,
  buildLowFitWarningGate,
  shouldPreRewriteLowFitBlock,
} from '@/lib/agent/job-targeting/low-fit-warning-gate'
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
      topUnsupportedSignalsForDisplay: ['Java', 'Spring Boot', 'Docker'],
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
        topUnsupportedSignalsForDisplay: ['Java', 'Spring Boot', 'Docker'],
      },
    })

    expect(gate.triggered).toBe(true)
    expect(gate.reason).toBe('very_low_match_score')
  })

  it('does not trigger a strong low-fit gate from match score alone when core requirements have meaningful evidence', () => {
    const targetEvidence: TargetEvidence[] = [
      {
        jobSignal: 'SQL',
        canonicalSignal: 'SQL',
        evidenceLevel: 'explicit',
        rewritePermission: 'can_claim_directly',
        matchedResumeTerms: ['SQL'],
        supportingResumeSpans: ['SQL'],
        rationale: 'Existe no currÃ­culo.',
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
        supportingResumeSpans: ['dashboards em Power BI'],
        rationale: 'Existe no currÃ­culo.',
        confidence: 1,
        allowedRewriteForms: ['Dashboards'],
        forbiddenRewriteForms: [],
        validationSeverityIfViolated: 'none',
      },
      {
        jobSignal: 'DAX',
        canonicalSignal: 'DAX',
        evidenceLevel: 'unsupported_gap',
        rewritePermission: 'must_not_claim',
        matchedResumeTerms: [],
        supportingResumeSpans: [],
        rationale: 'Sem evidÃªncia real.',
        confidence: 0.98,
        allowedRewriteForms: [],
        forbiddenRewriteForms: ['DAX'],
        validationSeverityIfViolated: 'critical',
      },
    ]

    const gate = buildLowFitWarningGate({
      matchScore: 32,
      careerFitEvaluation: {
        riskLevel: 'high',
        signals: {
          matchScore: 32,
          missingSkillsCount: 2,
          familyDistance: 'distant',
        },
      },
      targetEvidence,
      coreRequirementCoverage: {
        total: 6,
        supported: 3,
        unsupported: 3,
        unsupportedSignals: ['DAX', 'Microsoft Fabric'],
        topUnsupportedSignalsForDisplay: ['DAX', 'Microsoft Fabric'],
      },
    })

    expect(gate.triggered).toBe(false)
    expect(gate.reason).toBeUndefined()
  })

  it('does not trigger low-fit block when match score is high and core coverage is partial', () => {
    const gate = buildLowFitWarningGate({
      matchScore: 79,
      careerFitEvaluation: {
        riskLevel: 'high',
        signals: {
          matchScore: 79,
          missingSkillsCount: 14,
          familyDistance: 'distant',
        },
      },
      targetRoleConfidence: 'high',
      targetRolePositioning: {
        targetRole: 'Analista De BI',
        permission: 'must_not_claim_target_role',
        reason: 'career_fit_high_risk',
        safeRolePositioning: 'Profissional com experiÃªncia em SQL e dashboards.',
        forbiddenRoleClaims: ['Analista De BI'],
      },
      targetEvidence: [
        {
          jobSignal: 'SQL',
          canonicalSignal: 'SQL',
          evidenceLevel: 'explicit',
          rewritePermission: 'can_claim_directly',
          matchedResumeTerms: ['SQL'],
          supportingResumeSpans: ['SQL'],
          rationale: 'Existe no currÃ­culo.',
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
          rationale: 'Existe no currÃ­culo.',
          confidence: 1,
          allowedRewriteForms: ['Dashboards'],
          forbiddenRewriteForms: [],
          validationSeverityIfViolated: 'none',
        },
        ...Array.from({ length: 13 }, (_, index): TargetEvidence => ({
          jobSignal: `Gap ${index + 1}`,
          canonicalSignal: `Gap ${index + 1}`,
          evidenceLevel: 'unsupported_gap',
          rewritePermission: 'must_not_claim',
          matchedResumeTerms: [],
          supportingResumeSpans: [],
          rationale: 'Sem evidÃªncia real.',
          confidence: 0.98,
          allowedRewriteForms: [],
          forbiddenRewriteForms: [`Gap ${index + 1}`],
          validationSeverityIfViolated: 'critical',
        })),
      ],
      coreRequirementCoverage: {
        total: 23,
        supported: 4,
        unsupported: 19,
        unsupportedSignals: ['DAX', 'tratamento e integraÃ§Ã£o de dados'],
        topUnsupportedSignalsForDisplay: ['DAX', 'Tratamento e integraÃ§Ã£o de dados'],
      },
    })

    expect(gate.triggered).toBe(false)
    expect(gate.reason).toBeUndefined()
    expect(gate.reason).not.toBe('too_many_unsupported_core_requirements')
  })

  it('flags an extreme off-target case for pre-rewrite blocking', () => {
    expect(shouldPreRewriteLowFitBlock({
      lowFitWarningGate: buildLowFitGate({
        matchScore: 28,
        explicitEvidenceRatio: 0.077,
        unsupportedGapRatio: 0.923,
        coreRequirementCoverage: {
          total: 7,
          supported: 0,
          unsupported: 7,
          unsupportedSignals: ['Java', 'Spring Boot', 'Docker'],
          topUnsupportedSignalsForDisplay: ['Java', 'Spring Boot', 'Docker'],
        },
      }),
    })).toBe(true)
  })

  it('does not pre-block adjacent cases with some real core coverage', () => {
    expect(shouldPreRewriteLowFitBlock({
      lowFitWarningGate: buildLowFitGate({
        triggered: false,
        matchScore: 71,
        explicitEvidenceRatio: 0.38,
        unsupportedGapRatio: 0.34,
        coreRequirementCoverage: {
          total: 6,
          supported: 3,
          unsupported: 3,
          unsupportedSignals: ['People Analytics', 'RPA', 'Power Apps'],
          topUnsupportedSignalsForDisplay: ['People Analytics', 'RPA', 'Power Apps'],
        },
      }),
    })).toBe(false)
  })

  it('skips the pre-rewrite block after explicit low-fit acceptance', () => {
    expect(shouldPreRewriteLowFitBlock({
      lowFitWarningGate: buildLowFitGate(),
      skipPreRewriteLowFitBlock: true,
    })).toBe(false)
  })
})
