import { describe, expect, it } from 'vitest'

import {
  buildTargetRolePositioning,
  buildUserFacingValidationBlockModal,
} from '@/lib/agent/job-targeting/recoverable-validation'
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

  it('does not position version-control-only evidence as a better career fit in low-fit copy', () => {
    const modal = buildUserFacingValidationBlockModal({
      targetRole: 'Gerente De Contas',
      originalProfileLabel: 'Git',
      directClaimsAllowed: ['Git'],
      targetEvidence: [{
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
      }],
      lowFitWarningGate: {
        triggered: true,
        reason: 'high_risk_off_target',
        matchScore: 18,
        riskLevel: 'high',
        familyDistance: 'distant',
        explicitEvidenceCount: 1,
        unsupportedGapCount: 8,
        unsupportedGapRatio: 0.89,
        explicitEvidenceRatio: 0.11,
        coreRequirementCoverage: {
          total: 9,
          supported: 1,
          unsupported: 8,
          unsupportedSignals: ['Gestao de contas', 'P&L', 'forecast e budget'],
          topUnsupportedSignalsForDisplay: ['Gestao de contas', 'P&L', 'forecast e budget'],
        },
      },
      validationIssues: [{
        severity: 'high',
        section: 'summary',
        issueType: 'low_fit_target_role',
        message: 'Pouca evidencia para os requisitos centrais da vaga.',
        userFacingExplanation: 'Encontramos poucos pontos comprovados para requisitos centrais como gestao de contas, P&L e forecast.',
      }],
    })

    const copy = [
      modal.primaryProblem,
      ...modal.problemBullets,
    ].join(' ')

    expect(copy).not.toMatch(/\bGit\b/i)
    expect(copy).not.toMatch(/comprova melhor experi/i)
    expect(copy).toContain('gestao de contas')
  })

  it('removes weak version-control bridge signals while keeping stronger adjacent evidence', () => {
    const modal = buildUserFacingValidationBlockModal({
      targetRole: 'Desenvolvedor Java',
      originalProfileLabel: 'BI, Engenharia de Dados, SQL e Python',
      directClaimsAllowed: ['Git', 'APIs REST', 'SQL'],
      targetEvidence: [],
      lowFitWarningGate: {
        triggered: true,
        reason: 'high_risk_off_target',
        matchScore: 32,
        riskLevel: 'high',
        familyDistance: 'distant',
        explicitEvidenceCount: 3,
        unsupportedGapCount: 12,
        unsupportedGapRatio: 0.8,
        explicitEvidenceRatio: 0.2,
        coreRequirementCoverage: {
          total: 15,
          supported: 3,
          unsupported: 12,
          unsupportedSignals: ['Java', 'Spring Boot', 'JPA/Hibernate'],
          topUnsupportedSignalsForDisplay: ['Java', 'Spring Boot', 'JPA/Hibernate'],
        },
      },
      validationIssues: [{
        severity: 'high',
        section: 'summary',
        issueType: 'low_fit_target_role',
        message: 'Pouca evidencia para Java.',
      }],
    })

    expect(modal.problemBullets).toEqual(expect.arrayContaining([
      'Encontramos alguns pontos próximos, como APIs REST e SQL, mas eles não sustentam uma apresentação direta como Desenvolvedor Java.',
    ]))
    expect(modal.problemBullets.join(' ')).not.toMatch(/\bGit\b/i)
  })
})
