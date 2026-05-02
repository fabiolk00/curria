import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as coreRequirementCoverageModule from '@/lib/agent/job-targeting/core-requirement-coverage'
import * as evidenceClassifierModule from '@/lib/agent/job-targeting/evidence-classifier'
import * as lowFitWarningGateModule from '@/lib/agent/job-targeting/low-fit-warning-gate'
import * as safeTargetingEmphasisModule from '@/lib/agent/job-targeting/safe-targeting-emphasis'
import * as rewritePermissionsModule from '@/lib/agent/job-targeting/rewrite-permissions'
import { buildTargetedRewritePlan, buildTargetingPlan } from '@/lib/agent/tools/build-targeting-plan'
import type { JobCompatibilityAssessment, RequirementEvidence } from '@/lib/agent/job-targeting/compatibility/types'
import type { CVState, GapAnalysisResult } from '@/types/cv'

const { mockOpenAICompletionCreate, mockCallOpenAIWithRetry, mockTrackApiUsage } = vi.hoisted(() => ({
  mockOpenAICompletionCreate: vi.fn(),
  mockCallOpenAIWithRetry: vi.fn(),
  mockTrackApiUsage: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: {
    chat: {
      completions: {
        create: mockOpenAICompletionCreate,
      },
    },
  },
}))

vi.mock('@/lib/openai/chat', () => ({
  callOpenAIWithRetry: mockCallOpenAIWithRetry,
  getChatCompletionText: (response: { choices?: Array<{ message?: { content?: string } }> }) =>
    response.choices?.[0]?.message?.content ?? '',
  getChatCompletionUsage: () => ({
    inputTokens: 10,
    outputTokens: 10,
  }),
}))

vi.mock('@/lib/agent/usage-tracker', () => ({
  trackApiUsage: mockTrackApiUsage,
}))

function buildCvState(): CVState {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    summary: 'Engenheira de dados com foco em SQL e automacao.',
    experience: [
      {
        title: 'Engenheira de Dados',
        company: 'Acme',
        startDate: '2022',
        endDate: '2024',
        bullets: ['Automatizei pipelines em SQL e Python.'],
      },
    ],
    skills: ['SQL', 'Python', 'ETL'],
    education: [],
    certifications: [],
  }
}

const gapAnalysis: GapAnalysisResult = {
  matchScore: 72,
  missingSkills: ['Airflow'],
  weakAreas: ['summary'],
  improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiência.'],
}

function assessmentRequirement(
  overrides: Partial<RequirementEvidence> & Pick<RequirementEvidence, 'id' | 'productGroup' | 'rewritePermission'>,
): RequirementEvidence {
  const signal = overrides.extractedSignals?.[0] ?? overrides.id

  return {
    id: overrides.id,
    originalRequirement: signal,
    normalizedRequirement: signal.toLowerCase(),
    extractedSignals: [signal],
    kind: 'skill',
    importance: 'core',
    evidenceLevel: overrides.productGroup === 'supported' ? 'explicit' : 'unsupported_gap',
    matchedResumeTerms: overrides.productGroup === 'supported' ? [signal] : [],
    supportingResumeSpans: overrides.productGroup === 'supported'
      ? [{ id: `span-${overrides.id}`, text: signal }]
      : [],
    confidence: overrides.productGroup === 'supported' ? 1 : 0.7,
    rationale: 'assessment fixture',
    source: 'exact',
    catalogTermIds: [],
    catalogCategoryIds: [],
    prohibitedTerms: overrides.productGroup === 'unsupported' ? [signal] : [],
    audit: {
      matcherVersion: 'test',
      precedence: ['exact'],
      catalogIds: [],
      catalogVersions: {},
      catalogTermIds: [],
      catalogCategoryIds: [],
    },
    ...overrides,
  }
}

function buildCompatibilityAssessment(): JobCompatibilityAssessment {
  const supported = assessmentRequirement({
    id: 'assessment-supported',
    productGroup: 'supported',
    rewritePermission: 'can_claim_directly',
    extractedSignals: ['Assessment supported signal'],
  })
  const unsupported = assessmentRequirement({
    id: 'assessment-unsupported',
    productGroup: 'unsupported',
    rewritePermission: 'must_not_claim',
    extractedSignals: ['Assessment unsupported signal'],
  })

  return {
    version: 'job-compat-assessment-v1',
    targetRole: 'Assessment Role',
    targetRoleConfidence: 'high',
    targetRoleSource: 'heuristic',
    requirements: [supported, unsupported],
    supportedRequirements: [supported],
    adjacentRequirements: [],
    unsupportedRequirements: [unsupported],
    claimPolicy: {
      allowedClaims: [{
        id: 'claim-supported',
        signal: 'Assessment supported signal',
        permission: 'allowed',
        evidenceBasis: [{ id: 'span-supported', text: 'Assessment supported signal' }],
        allowedTerms: ['Assessment supported signal'],
        prohibitedTerms: [],
        rationale: 'supported',
        requirementIds: ['assessment-supported'],
      }],
      cautiousClaims: [],
      forbiddenClaims: [{
        id: 'claim-unsupported',
        signal: 'Assessment unsupported signal',
        permission: 'forbidden',
        evidenceBasis: [],
        allowedTerms: [],
        prohibitedTerms: ['Assessment unsupported signal'],
        rationale: 'unsupported',
        requirementIds: ['assessment-unsupported'],
      }],
    },
    scoreBreakdown: {
      version: 'job-compat-score-v1',
      total: 84,
      maxTotal: 100,
      adjacentDiscount: 0.5,
      dimensions: {
        skills: 90,
        experience: 80,
        education: 75,
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
      formula: {
        supportedValue: 1,
        adjacentValue: 0.5,
        unsupportedValue: 0,
      },
      audit: {
        dimensionDetails: {
          skills: {
            id: 'skills',
            weight: 0.34,
            requirementCount: 1,
            supportedCount: 1,
            adjacentCount: 0,
            unsupportedCount: 0,
            rawScore: 0.9,
            weightedScore: 0.31,
          },
          experience: {
            id: 'experience',
            weight: 0.46,
            requirementCount: 1,
            supportedCount: 1,
            adjacentCount: 0,
            unsupportedCount: 0,
            rawScore: 0.8,
            weightedScore: 0.37,
          },
          education: {
            id: 'education',
            weight: 0.2,
            requirementCount: 0,
            supportedCount: 0,
            adjacentCount: 0,
            unsupportedCount: 0,
            rawScore: 0.75,
            weightedScore: 0.15,
          },
        },
      },
    },
    criticalGaps: [{
      id: 'critical-assessment-unsupported',
      signal: 'Assessment unsupported signal',
      kind: 'skill',
      importance: 'core',
      severity: 'critical',
      rationale: 'unsupported_core_requirement',
      requirementIds: ['assessment-unsupported'],
      prohibitedTerms: ['Assessment unsupported signal'],
    }],
    reviewNeededGaps: [],
    lowFit: {
      triggered: false,
      blocking: false,
      riskLevel: 'low',
      reasons: [],
      thresholdAudit: {
        score: 84,
        minimumScore: 25,
        unsupportedCoreCount: 1,
        totalCoreCount: 2,
        unsupportedCoreRatio: 0.5,
        supportedOrAdjacentCount: 1,
      },
    },
    catalog: {
      catalogIds: [],
      catalogVersions: {},
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
        allowedClaims: 1,
        cautiousClaims: 0,
        forbiddenClaims: 1,
        criticalGaps: 1,
        reviewNeededGaps: 0,
      },
    },
  }
}

describe('buildTargetingPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallOpenAIWithRetry.mockImplementation(async (fn: (signal?: AbortSignal) => Promise<unknown>) => fn())
    mockTrackApiUsage.mockResolvedValue(undefined)
  })

  it('does not run semantic evidence classification for the legacy targeting plan path', async () => {
    const classifySpy = vi.spyOn(evidenceClassifierModule, 'classifyTargetEvidence')
    const permissionsSpy = vi.spyOn(rewritePermissionsModule, 'buildTargetedRewritePermissions')
    const coreCoverageSpy = vi.spyOn(coreRequirementCoverageModule, 'buildCoreRequirementCoverage')
    const safeEmphasisSpy = vi.spyOn(safeTargetingEmphasisModule, 'buildSafeTargetingEmphasis')
    const lowFitSpy = vi.spyOn(lowFitWarningGateModule, 'buildLowFitWarningGate')

    const plan = await buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: 'Cargo: Analytics Engineer\nRequisitos: SQL e Power BI.',
      gapAnalysis,
    })

    expect(classifySpy).not.toHaveBeenCalled()
    expect(permissionsSpy).not.toHaveBeenCalled()
    expect(coreCoverageSpy).not.toHaveBeenCalled()
    expect(safeEmphasisSpy).not.toHaveBeenCalled()
    expect(lowFitSpy).not.toHaveBeenCalled()
    expect(mockOpenAICompletionCreate).not.toHaveBeenCalled()
    expect(plan.targetEvidence).toBeUndefined()
    expect(plan.rewritePermissions).toBeUndefined()
    expect(plan.safeTargetingEmphasis).toBeUndefined()
    expect(plan.coreRequirementCoverage).toBeUndefined()
    expect(plan.lowFitWarningGate).toBeUndefined()
    expect(plan.targetRolePositioning).toBeUndefined()
  })

  it('extracts a role from prose instead of promoting section headings', async () => {
    const plan = await buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'Requisitos Obrigatórios',
        'SQL avançado e modelagem de dados.',
        'Estamos contratando uma pessoa Engenheira de Dados para atuar com pipelines e analytics.',
      ].join('\n'),
      gapAnalysis,
    })

    expect(plan.targetRole).toBe('Engenheira De Dados')
    expect(plan.targetRoleConfidence).toBe('high')
    expect(plan.targetRoleSource).toBe('heuristic')
    expect(mockOpenAICompletionCreate).not.toHaveBeenCalled()
  })

  it('preserves explicit role labels when present', async () => {
    const plan = await buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'Cargo: Analytics Engineer',
        'Requisitos Obrigatórios',
        'SQL e BigQuery.',
      ].join('\n'),
      gapAnalysis,
    })

    expect(plan.targetRole).toBe('Analytics Engineer')
    expect(plan.targetRoleConfidence).toBe('high')
    expect(plan.targetRoleSource).toBe('heuristic')
    expect(mockOpenAICompletionCreate).not.toHaveBeenCalled()
  })

  it('falls back to richer prose when the explicit role label is too weak', async () => {
    const plan = await buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'Cargo: BI.',
        'Responsabilidades',
        'Estamos contratando Analista de BI para atuar com dashboards, SQL e indicadores.',
      ].join('\n'),
      gapAnalysis,
    })

    expect(plan.targetRole).toBe('Analista De BI')
    expect(plan.targetRoleConfidence).toBe('high')
    expect(plan.targetRoleSource).toBe('heuristic')
    expect(mockOpenAICompletionCreate).not.toHaveBeenCalled()
  })

  it('uses LLM extraction when the role is implied but not explicit', async () => {
    mockOpenAICompletionCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            targetRole: 'Product Manager',
            confidence: 'medium',
          }),
        },
      }],
    })

    const plan = await buildTargetedRewritePlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'About The Job',
        'Own roadmap prioritization, partner with design and engineering, and define product strategy.',
        'Drive discovery, stakeholder alignment, and go-to-market execution.',
      ].join('\n'),
      gapAnalysis,
      userId: 'usr_123',
      sessionId: 'sess_123',
      mode: 'job_targeting',
      rewriteIntent: 'targeted_rewrite',
    })

    expect(plan.targetRole).toBe('Product Manager')
    expect(plan.targetRoleConfidence).toBe('medium')
    expect(plan.targetRoleSource).toBe('llm')
    expect(mockOpenAICompletionCreate).toHaveBeenCalledTimes(2)
    expect(mockTrackApiUsage).toHaveBeenCalled()
  })

  it('falls back to Vaga Alvo when heuristic and LLM both fail', async () => {
    mockOpenAICompletionCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            targetRole: 'Unknown Role',
            confidence: 'low',
          }),
        },
      }],
    })

    const plan = await buildTargetedRewritePlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'About The Job',
        'Responsibilities',
        'Build Power BI dashboards and SQL models for analytics reporting.',
        'Requirements',
        'Strong SQL and Power BI experience.',
      ].join('\n'),
      gapAnalysis,
      mode: 'job_targeting',
      rewriteIntent: 'targeted_rewrite',
    })

    expect(plan.targetRole).toBe('Vaga Alvo')
    expect(plan.targetRoleConfidence).toBe('low')
    expect(plan.targetRoleSource).toBe('fallback')
    expect(plan.focusKeywords).toEqual(expect.arrayContaining(['power bi']))
    expect(plan.mustEmphasize).toEqual(expect.arrayContaining(['SQL']))
    expect(plan.targetEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        jobSignal: 'SQL',
        evidenceLevel: 'explicit',
      }),
      expect.objectContaining({
        jobSignal: 'Airflow',
        evidenceLevel: 'unsupported_gap',
      }),
    ]))
    expect(plan.rewritePermissions).toEqual(expect.objectContaining({
      directClaimsAllowed: expect.arrayContaining(['SQL']),
      forbiddenClaims: expect.arrayContaining(['Airflow']),
    }))
  })

  it('does not treat weak areas as invented missing requirements', async () => {
    const plan = await buildTargetingPlan({
      cvState: buildCvState(),
      targetJobDescription: 'Cargo: Analytics Engineer',
      gapAnalysis: {
        ...gapAnalysis,
        missingSkills: ['Airflow'],
        weakAreas: ['summary', 'experience'],
      },
    })

    expect(plan.missingButCannotInvent).toEqual(['Airflow'])
  })

  it('delegates compatibility-sensitive fields to the canonical assessment when provided', async () => {
    const classifySpy = vi.spyOn(evidenceClassifierModule, 'classifyTargetEvidence')
    const coreCoverageSpy = vi.spyOn(coreRequirementCoverageModule, 'buildCoreRequirementCoverage')
    const lowFitSpy = vi.spyOn(lowFitWarningGateModule, 'buildLowFitWarningGate')

    const plan = await buildTargetedRewritePlan({
      cvState: buildCvState(),
      targetJobDescription: [
        'About The Job',
        'Work on roadmap, discovery, and stakeholder alignment.',
      ].join('\n'),
      gapAnalysis: {
        ...gapAnalysis,
        matchScore: 12,
        missingSkills: ['Legacy missing signal'],
      },
      jobCompatibilityAssessment: buildCompatibilityAssessment(),
      mode: 'job_targeting',
      rewriteIntent: 'targeted_rewrite',
    })

    expect(mockOpenAICompletionCreate).not.toHaveBeenCalled()
    expect(classifySpy).not.toHaveBeenCalled()
    expect(coreCoverageSpy).not.toHaveBeenCalled()
    expect(lowFitSpy).not.toHaveBeenCalled()
    expect(plan.targetRole).toBe('Assessment Role')
    expect(plan.targetRoleConfidence).toBe('high')
    expect(plan.targetRoleSource).toBe('heuristic')
    expect(plan.targetEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        jobSignal: 'Assessment supported signal',
        evidenceLevel: 'explicit',
      }),
      expect.objectContaining({
        jobSignal: 'Assessment unsupported signal',
        evidenceLevel: 'unsupported_gap',
      }),
    ]))
    expect(plan.rewritePermissions).toEqual(expect.objectContaining({
      directClaimsAllowed: ['Assessment supported signal'],
      forbiddenClaims: ['Assessment unsupported signal'],
    }))
    expect(plan.coreRequirementCoverage).toEqual(expect.objectContaining({
      total: 2,
      supported: 1,
      unsupported: 1,
      topUnsupportedSignalsForDisplay: ['Assessment unsupported signal'],
    }))
    expect(plan.lowFitWarningGate).toEqual(expect.objectContaining({
      triggered: false,
      matchScore: 84,
      riskLevel: 'low',
    }))
  })

  it('adds a safe target role positioning when the target role is distant and gap-heavy', async () => {
    const plan = await buildTargetedRewritePlan({
      cvState: buildCvState(),
      targetJobDescription: 'Cargo: Analista de Sistemas de RH',
      gapAnalysis: {
        ...gapAnalysis,
        matchScore: 59,
        missingSkills: ['People Analytics', 'RPA', 'Power Platform'],
      },
      mode: 'job_targeting',
      rewriteIntent: 'targeted_rewrite',
      careerFitEvaluation: {
        riskLevel: 'high',
        needsExplicitConfirmation: true,
        summary: 'A trajetória principal continua mais próxima de BI e dados.',
        riskPoints: 3,
        assessedAt: '2026-04-27T12:00:00.000Z',
        signals: {
          familyDistance: 'distant',
          seniorityGapMajor: false,
        },
        reasons: ['Trajetória principal continua mais próxima de BI e dados.'],
      },
    })

    expect(plan.targetRolePositioning).toEqual(expect.objectContaining({
      permission: 'must_not_claim_target_role',
    }))
    expect(plan.targetRolePositioning?.safeRolePositioning).toContain('Profissional')
  })

  it('derives safe direct emphasis and cautious bridges for partially adherent systems and BI vacancies', async () => {
    const cvState = {
      ...buildCvState(),
      summary: 'Profissional de BI com foco em Power Automate, APIs REST, dashboards e relatórios gerenciais.',
      experience: [{
        title: 'Analista de BI',
        company: 'Acme',
        startDate: '2022',
        endDate: '2024',
        bullets: [
          'Automatizei fluxos com Power Automate e eliminei processos manuais.',
          'Integrei APIs REST e sistemas internos para relatórios gerenciais.',
          'Criei dashboards em Power BI e Qlik Sense para áreas corporativas.',
        ],
      }],
      skills: ['SQL', 'Python', 'Power BI', 'Qlik Sense', 'Power Automate', 'APIs REST', 'HTML', 'CSS'],
    }

    const plan = await buildTargetedRewritePlan({
      cvState,
      targetJobDescription: [
        'Cargo: Analista de Sistemas BI/RH',
        'Requisitos: Power BI, Qlik, SQL, Python, Power Automate, APIs REST, People Analytics, RPA.',
        'Desejável: Power Apps e FLUIG.',
      ].join('\n'),
      gapAnalysis: {
        ...gapAnalysis,
        matchScore: 71,
        missingSkills: ['People Analytics', 'RPA', 'Power Apps', 'FLUIG'],
        weakAreas: ['target role'],
      },
      mode: 'job_targeting',
      rewriteIntent: 'targeted_rewrite',
      careerFitEvaluation: {
        riskLevel: 'medium',
        needsExplicitConfirmation: false,
        summary: 'A vaga é adjacente ao histórico principal de BI.',
        riskPoints: 2,
        assessedAt: '2026-04-27T12:00:00.000Z',
        signals: {
          matchScore: 71,
          missingSkillsCount: 4,
          weakAreasCount: 1,
          familyDistance: 'adjacent',
          seniorityGapMajor: false,
        },
        reasons: ['Há aderência real em BI, automação e integrações.'],
      },
    })

    expect(plan.safeTargetingEmphasis?.safeDirectEmphasis).toEqual(expect.arrayContaining([
      'Power Automate',
      'APIs REST',
      'Power BI',
      'Qlik Sense',
    ]))
    expect(plan.safeTargetingEmphasis?.forbiddenDirectClaims).toEqual(expect.arrayContaining([
      'People Analytics',
      'RPA',
      'Power Apps',
      'FLUIG',
    ]))
    expect(plan.lowFitWarningGate?.triggered).toBe(false)
  })

  it('triggers the low-fit warning gate for off-target Java vacancies with unsupported core coverage', async () => {
    const plan = await buildTargetedRewritePlan({
      cvState: {
        ...buildCvState(),
        summary: 'Profissional de BI e engenharia de dados com foco em SQL, Python, ETL, APIs REST e Git.',
        experience: [{
          title: 'Analista de BI',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: [
            'Desenvolvi dashboards em Power BI e Qlik Sense.',
            'Modelei dados e integrações com APIs REST, SQL e Python.',
            'Automatizei rotinas com Power Automate e Databricks.',
          ],
        }],
        skills: ['Power BI', 'Qlik Sense', 'SQL', 'Python', 'PySpark', 'Databricks', 'ETL', 'APIs REST', 'Git'],
      },
      targetJobDescription: [
        'Cargo: Desenvolvedor Java',
        'Requisitos obrigatórios: Java com mais de 5 anos, orientação a objetos, SOLID, Spring Boot, APIs REST, JPA/Hibernate, bancos relacionais, Kafka/RabbitMQ, microsserviços, testes automatizados, Git, CI/CD, Docker, cloud, Kubernetes, observabilidade e performance.',
        'Profissional com experiência em decisões técnicas e mentoria.',
      ].join('\n'),
      gapAnalysis: {
        ...gapAnalysis,
        matchScore: 32,
        missingSkills: ['Java', '5+ anos Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'microsserviços', 'Docker', 'CI/CD', 'SOLID', 'testes automatizados', 'Kubernetes', 'observabilidade', 'performance', 'mentoria'],
        weakAreas: ['target role', 'stack core'],
      },
      mode: 'job_targeting',
      rewriteIntent: 'targeted_rewrite',
      careerFitEvaluation: {
        riskLevel: 'high',
        needsExplicitConfirmation: true,
        summary: 'A vaga pede uma trajetória de engenharia Java que não aparece de forma comprovada no currículo.',
        riskPoints: 5,
        assessedAt: '2026-04-27T12:00:00.000Z',
        signals: {
          matchScore: 32,
          missingSkillsCount: 14,
          weakAreasCount: 2,
          familyDistance: 'distant',
          seniorityGapMajor: true,
        },
        reasons: ['O histórico comprovado permanece centrado em BI e dados.'],
      },
    })

    expect(plan.targetRolePositioning).toEqual(expect.objectContaining({
      permission: 'must_not_claim_target_role',
    }))
    expect(plan.coreRequirementCoverage).toEqual(expect.objectContaining({
      total: expect.any(Number),
      unsupported: expect.any(Number),
      unsupportedSignals: expect.arrayContaining([
        'Java',
        '5+ anos de Java',
        'Spring Boot',
        'JPA/Hibernate',
        'Kafka/RabbitMQ',
        'microsserviços',
        'Docker',
        'CI/CD',
      ]),
    }))
    expect(plan.lowFitWarningGate).toEqual(expect.objectContaining({
      triggered: true,
      matchScore: 32,
      riskLevel: 'high',
    }))
  })

  it('emits enriched semantic and low-fit payload only for targeted rewrite', async () => {
    const plan = await buildTargetedRewritePlan({
      cvState: buildCvState(),
      targetJobDescription: 'Cargo: Analytics Engineer\nRequisitos: SQL, Python e Power BI.',
      gapAnalysis,
      mode: 'job_targeting',
      rewriteIntent: 'targeted_rewrite',
    })

    expect(plan.targetEvidence).toBeDefined()
    expect(plan.rewritePermissions).toBeDefined()
    expect(plan.safeTargetingEmphasis).toBeDefined()
    expect(plan.coreRequirementCoverage).toBeDefined()
    expect(plan.lowFitWarningGate).toBeDefined()
    expect(plan.targetRolePositioning).toBeDefined()
  })

  it('fails explicitly if the enriched targeted-rewrite builder is called without a target job description', async () => {
    await expect(buildTargetedRewritePlan({
      cvState: buildCvState(),
      targetJobDescription: '   ',
      gapAnalysis,
      mode: 'job_targeting',
      rewriteIntent: 'targeted_rewrite',
    })).rejects.toThrow('buildTargetedRewritePlan requires a target job description')
  })

  it('fails explicitly if the enriched builder is called outside job_targeting targeted_rewrite', async () => {
    await expect(buildTargetedRewritePlan({
      cvState: buildCvState(),
      targetJobDescription: 'Cargo: Analytics Engineer',
      gapAnalysis,
      mode: 'ats_enhancement',
      rewriteIntent: 'generic_rewrite',
    } as never)).rejects.toThrow('buildTargetedRewritePlan only supports job_targeting targeted_rewrite flows.')
  })
})
