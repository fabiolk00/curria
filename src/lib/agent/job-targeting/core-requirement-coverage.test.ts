import { describe, expect, it } from 'vitest'

import { buildCoreRequirementCoverage } from '@/lib/agent/job-targeting/core-requirement-coverage'
import type { TargetEvidence } from '@/types/agent'

describe('core requirement coverage', () => {
  it('separates unsupported Java core requirements from peripheral supported evidence', () => {
    const targetEvidence: TargetEvidence[] = [
      {
        jobSignal: 'Git',
        canonicalSignal: 'Git',
        evidenceLevel: 'explicit',
        rewritePermission: 'can_claim_directly',
        matchedResumeTerms: ['Git'],
        supportingResumeSpans: ['Git'],
        rationale: 'Evidência explícita.',
        confidence: 1,
        allowedRewriteForms: ['Git'],
        forbiddenRewriteForms: [],
        validationSeverityIfViolated: 'none',
      },
      {
        jobSignal: 'APIs REST',
        canonicalSignal: 'APIs REST',
        evidenceLevel: 'explicit',
        rewritePermission: 'can_claim_directly',
        matchedResumeTerms: ['APIs REST'],
        supportingResumeSpans: ['APIs REST'],
        rationale: 'Evidência explícita.',
        confidence: 1,
        allowedRewriteForms: ['APIs REST'],
        forbiddenRewriteForms: [],
        validationSeverityIfViolated: 'none',
      },
      {
        jobSignal: 'Java',
        canonicalSignal: 'Java',
        evidenceLevel: 'unsupported_gap',
        rewritePermission: 'must_not_claim',
        matchedResumeTerms: [],
        supportingResumeSpans: [],
        rationale: 'Sem evidência real.',
        confidence: 0.99,
        allowedRewriteForms: [],
        forbiddenRewriteForms: ['Java'],
        validationSeverityIfViolated: 'critical',
      },
    ]

    const coverage = buildCoreRequirementCoverage({
      targetJobDescription: [
        'Cargo: Desenvolvedor Java',
        'Requisitos obrigatórios: Java com mais de 5 anos, Spring Boot, JPA/Hibernate, Kafka/RabbitMQ, microsserviços, Docker, CI/CD e testes automatizados.',
        'Desejável: cloud e observabilidade.',
      ].join('\n'),
      targetRole: 'Desenvolvedor Java',
      targetEvidence,
      missingButCannotInvent: ['Spring Boot', 'JPA/Hibernate', 'Docker', 'CI/CD'],
      targetRolePositioning: {
        targetRole: 'Desenvolvedor Java',
        permission: 'must_not_claim_target_role',
        reason: 'career_fit_high_risk',
        safeRolePositioning: 'Profissional com experiência em BI, SQL e APIs REST.',
        forbiddenRoleClaims: ['Desenvolvedor Java'],
      },
    })

    expect(coverage.total).toBeGreaterThanOrEqual(5)
    expect(coverage.supported).toBeLessThan(coverage.total)
    expect(coverage.unsupportedSignals).toEqual(expect.arrayContaining([
      'Java com mais de 5 anos',
      'Spring Boot',
      'JPA/Hibernate',
      'Kafka/RabbitMQ',
      'microsserviços',
      'Docker',
      'CI/CD',
    ]))
  })
})
