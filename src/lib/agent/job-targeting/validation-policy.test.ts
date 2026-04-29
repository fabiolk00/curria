import { describe, expect, it } from 'vitest'

import { buildTargetedRewritePermissionIssues } from '@/lib/agent/job-targeting/validation-policy'
import type { TargetEvidence, TargetingPlan } from '@/types/agent'
import type { CVState } from '@/types/cv'

function buildCvState(overrides: Partial<CVState> = {}): CVState {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    summary: 'Profissional com foco em analise e melhoria continua.',
    experience: [{
      title: 'Analista',
      company: 'Acme',
      startDate: '2022',
      endDate: '2024',
      bullets: ['Atuei com melhoria continua e padronizacao de processos.'],
    }],
    skills: ['Melhoria continua', 'SQL'],
    education: [],
    certifications: [],
    ...overrides,
  }
}

function buildEvidence(overrides: Partial<TargetEvidence> = {}): TargetEvidence {
  return {
    jobSignal: 'Lean Six Sigma',
    canonicalSignal: 'Lean Six Sigma',
    evidenceLevel: 'semantic_bridge_only',
    rewritePermission: 'can_mention_as_related_context',
    matchedResumeTerms: ['melhoria continua'],
    supportingResumeSpans: ['Atuei com melhoria continua e padronizacao de processos.'],
    rationale: 'Adjacent continuous-improvement evidence only.',
    confidence: 0.74,
    allowedRewriteForms: ['melhoria continua'],
    forbiddenRewriteForms: ['Lean Six Sigma'],
    validationSeverityIfViolated: 'major',
    ...overrides,
  }
}

function buildTargetingPlan(overrides: Partial<TargetingPlan> = {}): TargetingPlan {
  return {
    targetRole: 'Operations Analyst',
    targetRoleConfidence: 'high',
    targetRoleSource: 'heuristic',
    focusKeywords: [],
    mustEmphasize: [],
    shouldDeemphasize: [],
    missingButCannotInvent: [],
    targetEvidence: [],
    rewritePermissions: {
      directClaimsAllowed: [],
      normalizedClaimsAllowed: [],
      bridgeClaimsAllowed: [],
      relatedButNotClaimable: [],
      forbiddenClaims: [],
      skillsSurfaceAllowed: [],
    },
    sectionStrategy: {
      summary: [],
      experience: [],
      skills: [],
      education: [],
      certifications: [],
    },
    ...overrides,
  }
}

describe('buildTargetedRewritePermissionIssues', () => {
  it('allows a careful bridge in summary when it stays anchored in a real supporting span', () => {
    const issues = buildTargetedRewritePermissionIssues({
      originalCvState: buildCvState(),
      optimizedCvState: buildCvState({
      summary: 'Profissional com experiência relacionada a Lean Six Sigma a partir de melhoria continua e padronizacao de processos.',
      }),
      targetingPlan: buildTargetingPlan({
        targetEvidence: [buildEvidence()],
      }),
    })

    expect(issues).toEqual([])
  })

  it('blocks bridge-only claims from entering the skills surface', () => {
    const issues = buildTargetedRewritePermissionIssues({
      originalCvState: buildCvState(),
      optimizedCvState: buildCvState({
        skills: ['Melhoria continua', 'SQL', 'Lean Six Sigma'],
      }),
      targetingPlan: buildTargetingPlan({
        targetEvidence: [buildEvidence()],
      }),
    })

    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'high',
      section: 'skills',
    }))
  })

  it('blocks unsupported gaps across summary and experience surfaces', () => {
    const issues = buildTargetedRewritePermissionIssues({
      originalCvState: buildCvState(),
      optimizedCvState: buildCvState({
        summary: 'Profissional com foco em Airflow.',
        experience: [{
          title: 'Analista',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Implementei Airflow em pipelines criticos.'],
        }],
      }),
      targetingPlan: buildTargetingPlan({
        targetEvidence: [buildEvidence({
          jobSignal: 'Airflow',
          canonicalSignal: 'Airflow',
          evidenceLevel: 'unsupported_gap',
          rewritePermission: 'must_not_claim',
          matchedResumeTerms: [],
          supportingResumeSpans: [],
          confidence: 0.95,
          allowedRewriteForms: [],
          forbiddenRewriteForms: ['Airflow'],
          validationSeverityIfViolated: 'critical',
        })],
      }),
    })

    expect(issues).toContainEqual(expect.objectContaining({
      code: 'unsupported_claim_added',
      severity: 'high',
      message: expect.stringContaining('requisito sem suporte factual'),
    }))
  })

  it('rejects bridge claims that are not anchored in a real supporting span', () => {
    const issues = buildTargetedRewritePermissionIssues({
      originalCvState: buildCvState(),
      optimizedCvState: buildCvState({
      summary: 'Profissional com experiência relacionada a Lean Six Sigma em transformacoes globais.',
      }),
      targetingPlan: buildTargetingPlan({
        targetEvidence: [buildEvidence({
          supportingResumeSpans: ['Atuei com melhoria continua e padronizacao de processos.'],
        })],
      }),
    })

    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'high',
      message: expect.stringContaining('ponte semântica sem ancoragem'),
    }))
  })

  it('allows high-confidence technical equivalents on the skills surface but keeps lower-confidence ones off it', () => {
    const highConfidenceIssues = buildTargetedRewritePermissionIssues({
      originalCvState: buildCvState({
        skills: ['star schema', 'snowflake schema'],
      }),
      optimizedCvState: buildCvState({
        skills: ['star schema', 'snowflake schema', 'modelagem dimensional'],
      }),
      targetingPlan: buildTargetingPlan({
        targetEvidence: [buildEvidence({
          jobSignal: 'modelagem dimensional',
          canonicalSignal: 'modelagem dimensional',
          evidenceLevel: 'technical_equivalent',
          rewritePermission: 'can_claim_normalized',
          matchedResumeTerms: ['star schema', 'snowflake schema'],
          supportingResumeSpans: ['Atuei com star schema e snowflake schema.'],
          confidence: 0.9,
          allowedRewriteForms: ['modelagem dimensional'],
          forbiddenRewriteForms: [],
          validationSeverityIfViolated: 'none',
        })],
        rewritePermissions: {
          directClaimsAllowed: [],
          normalizedClaimsAllowed: ['modelagem dimensional'],
          bridgeClaimsAllowed: [],
          relatedButNotClaimable: [],
          forbiddenClaims: [],
          skillsSurfaceAllowed: ['modelagem dimensional'],
        },
      }),
    })

    expect(highConfidenceIssues).toEqual([])

    const lowConfidenceIssues = buildTargetedRewritePermissionIssues({
      originalCvState: buildCvState({
        skills: ['star schema', 'snowflake schema'],
      }),
      optimizedCvState: buildCvState({
        skills: ['star schema', 'snowflake schema', 'modelagem dimensional'],
      }),
      targetingPlan: buildTargetingPlan({
        targetEvidence: [buildEvidence({
          jobSignal: 'modelagem dimensional',
          canonicalSignal: 'modelagem dimensional',
          evidenceLevel: 'technical_equivalent',
          rewritePermission: 'can_claim_normalized',
          matchedResumeTerms: ['star schema', 'snowflake schema'],
          supportingResumeSpans: ['Atuei com star schema e snowflake schema.'],
          confidence: 0.6,
          allowedRewriteForms: ['modelagem dimensional'],
          forbiddenRewriteForms: [],
          validationSeverityIfViolated: 'none',
        })],
        rewritePermissions: {
          directClaimsAllowed: [],
          normalizedClaimsAllowed: ['modelagem dimensional'],
          bridgeClaimsAllowed: [],
          relatedButNotClaimable: [],
          forbiddenClaims: [],
          skillsSurfaceAllowed: [],
        },
      }),
    })

    expect(lowConfidenceIssues).toContainEqual(expect.objectContaining({
      section: 'skills',
    }))
  })

  it('flags seniority inflation for contextual bridges in non-technical domains too', () => {
    const issues = buildTargetedRewritePermissionIssues({
      originalCvState: buildCvState({
        summary: 'Profissional de marketing com foco em CRM.',
        experience: [{
          title: 'Marketing Analyst',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Conduzi campanhas de retencao, CRM e jornadas de cliente.'],
        }],
        skills: ['CRM', 'Retencao'],
      }),
      optimizedCvState: buildCvState({
        summary: 'Especialista em lifecycle marketing com base em CRM, retencao e jornadas de cliente.',
        experience: [{
          title: 'Marketing Analyst',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Conduzi campanhas de retencao, CRM e jornadas de cliente.'],
        }],
        skills: ['CRM', 'Retencao'],
      }),
      targetingPlan: buildTargetingPlan({
        targetEvidence: [buildEvidence({
          jobSignal: 'lifecycle marketing',
          canonicalSignal: 'lifecycle marketing',
          evidenceLevel: 'strong_contextual_inference',
          rewritePermission: 'can_bridge_carefully',
          matchedResumeTerms: ['CRM', 'retencao', 'jornada de cliente'],
          supportingResumeSpans: ['Conduzi campanhas de retencao, CRM e jornadas de cliente.'],
          confidence: 0.8,
          allowedRewriteForms: ['lifecycle marketing'],
          forbiddenRewriteForms: ['especialista em lifecycle marketing'],
          validationSeverityIfViolated: 'warning',
        })],
      }),
    })

    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'high',
    message: expect.stringContaining('senioridade ou domínio não comprovado'),
      section: 'summary',
    }))
  })
})
