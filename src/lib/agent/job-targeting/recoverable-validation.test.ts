import { describe, expect, it } from 'vitest'

import {
  buildConservativeSummaryFallback,
  buildTargetRolePositioning,
  buildUserFacingValidationBlockModal,
} from '@/lib/agent/job-targeting/recoverable-validation'
import type { TargetEvidence, TargetingPlan } from '@/types/agent'

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
    expect(modal.primaryProblem).toBe('A vaga exige requisitos que seu currículo ainda não comprova de forma direta.')
    expect(modal.problemBullets).toEqual([
      'Sem evidência direta de Gestao de contas.',
      'Sem evidência direta de P&L.',
      'Sem evidência direta de forecast e budget.',
    ])
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
      'Há pontos próximos, como APIs REST e SQL, mas eles não sustentam uma apresentação direta como Desenvolvedor Java.',
    ]))
    expect(modal.problemBullets.join(' ')).not.toMatch(/\bGit\b/i)
  })

  it('keeps low-fit requirement copy concise and capped for long commercial vacancies', () => {
    const modal = buildUserFacingValidationBlockModal({
      targetRole: 'Gerente De Contas',
      lowFitWarningGate: {
        triggered: true,
        reason: 'high_risk_off_target',
        matchScore: 18,
        riskLevel: 'high',
        familyDistance: 'distant',
        explicitEvidenceCount: 1,
        unsupportedGapCount: 10,
        unsupportedGapRatio: 0.9,
        explicitEvidenceRatio: 0.1,
        coreRequirementCoverage: {
          total: 10,
          supported: 1,
          unsupported: 9,
          unsupportedSignals: [],
          topUnsupportedSignalsForDisplay: [
            'Metodologias ágeis aplicadas à gestão de operação/produto',
            'Vivência com gestão financeira de contas',
            'P&L, margem, faturamento, forecast e budget',
            'Estruturação de propostas comerciais, escopo e precificação',
            'Gestão de contratos, renovações, aditivos e medições',
            'Gestão de pessoas, alocação e desenvolvimento de times',
            'Gestão de contas estratégicas e relacionamento executivo com clientes',
          ],
        },
      },
      validationIssues: [{
        severity: 'high',
        section: 'summary',
        issueType: 'low_fit_target_role',
        message: 'Pouca evidência para os requisitos centrais da vaga.',
        userFacingExplanation: 'Encontramos poucos pontos comprovados para requisitos centrais como metodologias ágeis, P&L e propostas comerciais.',
      }],
    })

    expect(modal.primaryProblem).not.toContain('Metodologias ágeis aplicadas')
    expect(modal.problemBullets).toHaveLength(5)
    expect(modal.problemBullets).toEqual([
      'Sem evidência direta de Metodologias ágeis aplicadas à gestão de operação/produto.',
      'Sem evidência direta de Vivência com gestão financeira de contas.',
      'Sem evidência direta de P&L, margem, faturamento, forecast e budget.',
      'Sem evidência direta de Estruturação de propostas comerciais, escopo e precificação.',
      'Sem evidência direta de Gestão de contratos, renovações, aditivos e medições.',
    ])
    expect(modal.problemBullets.join(' ')).not.toContain('Encontramos poucos pontos comprovados')
  })
})

describe('buildConservativeSummaryFallback', () => {
  it('builds a conservative summary from supported signals without claiming forbidden target gaps', () => {
    const targetingPlan = {
      targetRole: 'Business Intelligence (BI) Desde A Concepcao Ate A Implementacao',
      rewritePermissions: {
        directClaimsAllowed: ['SQL', 'ETL', 'modelagem de dados dimensional', 'analise e interpretacao de dados'],
        normalizedClaimsAllowed: [],
        bridgeClaimsAllowed: [],
        relatedButNotClaimable: [],
        forbiddenClaims: ['BI', 'Conhecimento na ferramenta Qlik', 'Certificacao Qlik'],
        skillsSurfaceAllowed: ['SQL', 'ETL', 'modelagem de dados dimensional', 'analise e interpretacao de dados'],
      },
      safeTargetingEmphasis: {
        safeDirectEmphasis: ['SQL', 'ETL', 'modelagem de dados dimensional'],
        cautiousBridgeEmphasis: [],
      },
      targetEvidence: [
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
          jobSignal: 'Conhecimento na ferramenta Qlik',
          canonicalSignal: 'Conhecimento na ferramenta Qlik',
          evidenceLevel: 'unsupported_gap',
          rewritePermission: 'must_not_claim',
          matchedResumeTerms: [],
          supportingResumeSpans: [],
          rationale: 'Sem evidencia.',
          confidence: 0.95,
          allowedRewriteForms: [],
          forbiddenRewriteForms: ['Qlik'],
          validationSeverityIfViolated: 'critical',
        },
      ],
      targetRolePositioning: {
        targetRole: 'Business Intelligence (BI) Desde A Concepcao Ate A Implementacao',
        permission: 'can_bridge_to_target_role',
        reason: 'partial_fit_supported_by_core_evidence',
        safeRolePositioning: 'Profissional com experiencia em SQL, ETL e modelagem de dados dimensional.',
        forbiddenRoleClaims: ['Business Intelligence (BI) Desde A Concepcao Ate A Implementacao'],
      },
    } as unknown as TargetingPlan

    const summary = buildConservativeSummaryFallback({
      originalSummary: 'Resumo original.',
      targetingPlan,
    })

    expect(summary).toContain('SQL')
    expect(summary).toContain('ETL')
    expect(summary).toContain('modelagem de dados dimensional')
    expect(summary).not.toMatch(/\bQlik\b/i)
    expect(summary).not.toContain('Business Intelligence (BI) Desde')
  })
})
