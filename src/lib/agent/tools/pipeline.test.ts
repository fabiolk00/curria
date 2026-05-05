// Full test gate for this module and its Phase 97 hardening:
//
// npx vitest run \
//   src/lib/agent/tools/detect-cv-highlights.test.ts \
//   src/lib/resume/cv-highlight-artifact.test.ts \
//   src/lib/agent/tools/pipeline.test.ts \
//   src/lib/routes/session-comparison/decision.test.ts \
//   src/components/resume/resume-comparison-view.test.tsx
//
// All five files must be included. Running a subset masks cross-file regressions.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RewriteClaimTraceItem, Session } from '@/types/agent'
import type { TargetingPlan } from '@/types/agent'
import type { CVState } from '@/types/cv'
import type {
  JobCompatibilityAssessment,
  RequirementEvidence,
  RequirementEvidenceSource,
} from '@/lib/agent/job-targeting/compatibility/types'

import { buildCompatibilityAssessmentFixture } from '@/lib/agent/job-targeting/__tests__/assessment-fixture'
import { runAtsEnhancementPipeline } from '@/lib/agent/ats-enhancement-pipeline'
import {
  buildAcceptedLowFitFallbackCvState,
  relaxValidationForAcceptedLowFitOverride,
  runJobTargetingPipeline,
  shouldBlockAfterAcceptedOverride,
} from '@/lib/agent/job-targeting-pipeline'
import { rewriteResumeFull } from '@/lib/agent/tools/rewrite-resume-full'
import { createExperienceBulletHighlightItemId } from '@/lib/resume/cv-highlight-artifact'
import { resetOpenAICircuitBreakerForTest } from '@/lib/openai/chat'

const {
  mockAnalyzeAtsGeneral,
  mockAnalyzeGap,
  mockEvaluateJobCompatibility,
  mockBuildTargetingPlan,
  mockBuildTargetedRewritePlan,
  mockDeriveTargetFitAssessment,
  mockRewriteSection,
  mockValidateRewrite,
  mockGenerateCvHighlightState,
  mockCreateCvVersion,
  mockCreateJobCompatibilityShadowComparison,
  mockUpdateSession,
  mockLogInfo,
  mockLogWarn,
  mockLogError,
  createCompletion,
  mockRecordMetricCounter,
} = vi.hoisted(() => ({
  mockAnalyzeAtsGeneral: vi.fn(),
  mockAnalyzeGap: vi.fn(),
  mockEvaluateJobCompatibility: vi.fn(),
  mockBuildTargetingPlan: vi.fn(),
  mockBuildTargetedRewritePlan: vi.fn(),
  mockDeriveTargetFitAssessment: vi.fn(),
  mockRewriteSection: vi.fn(),
  mockValidateRewrite: vi.fn(),
  mockGenerateCvHighlightState: vi.fn(),
  mockCreateCvVersion: vi.fn(),
  mockCreateJobCompatibilityShadowComparison: vi.fn(),
  mockUpdateSession: vi.fn(),
  mockLogInfo: vi.fn(),
  mockLogWarn: vi.fn(),
  mockLogError: vi.fn(),
  createCompletion: vi.fn(),
  mockRecordMetricCounter: vi.fn(),
}))

vi.mock('@/lib/agent/tools/ats-analysis', () => ({
  analyzeAtsGeneral: mockAnalyzeAtsGeneral,
}))

vi.mock('@/lib/agent/tools/gap-analysis', () => ({
  analyzeGap: mockAnalyzeGap,
}))

vi.mock('@/lib/agent/job-targeting/compatibility/assessment', () => ({
  evaluateJobCompatibility: mockEvaluateJobCompatibility,
}))

vi.mock('@/lib/agent/tools/build-targeting-plan', () => ({
  buildTargetingPlan: mockBuildTargetingPlan,
  buildTargetedRewritePlan: mockBuildTargetedRewritePlan,
}))

vi.mock('@/lib/agent/target-fit', () => ({
  deriveTargetFitAssessment: mockDeriveTargetFitAssessment,
}))

vi.mock('@/lib/agent/tools/rewrite-section', () => ({
  rewriteSection: mockRewriteSection,
}))

vi.mock('@/lib/agent/tools/validate-rewrite', () => ({
  validateRewrite: mockValidateRewrite,
}))

vi.mock('@/lib/db/cv-versions', () => ({
  createCvVersion: mockCreateCvVersion,
}))

vi.mock('@/lib/db/job-compatibility-shadow-comparison', () => ({
  createJobCompatibilityShadowComparison: mockCreateJobCompatibilityShadowComparison,
}))

vi.mock('@/lib/db/sessions', () => ({
  updateSession: mockUpdateSession,
}))

vi.mock('@/lib/agent/tools/detect-cv-highlights', () => ({
  generateCvHighlightState: mockGenerateCvHighlightState,
}))

vi.mock('@/lib/openai/client', () => ({
  openai: {
    chat: {
      completions: {
        create: createCompletion,
      },
    },
  },
}))

vi.mock('@/lib/agent/usage-tracker', () => ({
  trackApiUsage: vi.fn(() => Promise.resolve(undefined)),
}))

vi.mock('@/lib/observability/metric-events', () => ({
  recordMetricCounter: mockRecordMetricCounter,
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logInfo: mockLogInfo,
  logWarn: mockLogWarn,
  logError: mockLogError,
  serializeError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}))

function buildCvState(): CVState {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    summary: 'Analista de dados com foco em BI e SQL.',
    experience: [
      {
        title: 'Analista de Dados',
        company: 'Acme',
        startDate: '2022',
        endDate: '2024',
        bullets: Array.from({ length: 8 }, (_, index) =>
          `Bullet muito longa ${index} ${'resultado e contexto '.repeat(20)}`),
      },
    ],
    skills: ['SQL', 'Power BI', 'ETL'],
    education: [
      { degree: 'Bacharel em Sistemas', institution: 'USP', year: '2020' },
    ],
    certifications: [
      { name: 'AWS Cloud Practitioner', issuer: 'AWS', year: '2024' },
    ],
  }
}

function buildSession(): Session {
  return {
    id: 'sess_ats_123',
    userId: 'usr_123',
    stateVersion: 1,
    phase: 'dialog',
    cvState: buildCvState(),
    agentState: {
      parseStatus: 'parsed',
      rewriteHistory: {},
      workflowMode: 'ats_enhancement',
    },
    generatedOutput: { status: 'idle' },
    creditsUsed: 0,
    messageCount: 1,
    creditConsumed: false,
    createdAt: new Date('2026-04-14T12:00:00.000Z'),
    updatedAt: new Date('2026-04-14T12:00:00.000Z'),
  }
}

function buildDefaultTargetingPlan(overrides: Partial<TargetingPlan> = {}): TargetingPlan {
  return {
    targetRole: 'Analytics Engineer',
    targetRoleConfidence: 'high',
    targetRoleSource: 'heuristic',
    focusKeywords: ['sql', 'bigquery'],
    mustEmphasize: ['SQL', 'BigQuery'],
    shouldDeemphasize: [],
    missingButCannotInvent: ['BigQuery'],
    targetEvidence: [
      {
        jobSignal: 'SQL',
        canonicalSignal: 'SQL',
        evidenceLevel: 'explicit',
        rewritePermission: 'can_claim_directly',
        matchedResumeTerms: ['SQL'],
        supportingResumeSpans: ['SQL'],
      rationale: 'O termo aparece explicitamente no currículo.',
        confidence: 1,
        allowedRewriteForms: ['SQL'],
        forbiddenRewriteForms: [],
        validationSeverityIfViolated: 'none',
      },
      {
        jobSignal: 'BigQuery',
        canonicalSignal: 'BigQuery',
        evidenceLevel: 'unsupported_gap',
        rewritePermission: 'must_not_claim',
        matchedResumeTerms: [],
        supportingResumeSpans: [],
      rationale: 'Não ha evidencia suficiente no currículo.',
        confidence: 0.95,
        allowedRewriteForms: [],
        forbiddenRewriteForms: ['BigQuery'],
        validationSeverityIfViolated: 'critical',
      },
    ],
    rewritePermissions: {
      directClaimsAllowed: ['SQL'],
      normalizedClaimsAllowed: [],
      bridgeClaimsAllowed: [],
      relatedButNotClaimable: [],
      forbiddenClaims: ['BigQuery'],
      skillsSurfaceAllowed: ['SQL'],
    },
    targetRolePositioning: {
      targetRole: 'Analytics Engineer',
      permission: 'can_claim_target_role',
      reason: 'The mocked pipeline fixture explicitly permits the target-role label.',
      safeRolePositioning: 'Analytics Engineer',
      forbiddenRoleClaims: [],
    },
    coreRequirementCoverage: {
      requirements: [
        {
          signal: 'SQL',
          importance: 'core',
          requirementKind: 'required',
          evidenceLevel: 'explicit',
          rewritePermission: 'can_claim_directly',
        },
        {
          signal: 'BigQuery',
          importance: 'core',
          requirementKind: 'required',
          evidenceLevel: 'unsupported_gap',
          rewritePermission: 'must_not_claim',
        },
      ],
      total: 2,
      supported: 1,
      unsupported: 1,
      unsupportedSignals: ['BigQuery'],
      topUnsupportedSignalsForDisplay: ['BigQuery'],
      preferredSignalsForDisplay: [],
    },
    sectionStrategy: {
      summary: ['Aproxime o posicionamento da vaga sem inventar experiência.'],
      experience: ['Priorize stack e contexto relevantes.'],
      skills: ['Reordene por aderencia ao alvo.'],
      education: ['Mantenha factual.'],
      certifications: ['Destaque apenas o que agrega.'],
    },
    ...overrides,
  }
}

function cloneRequirementWithSource(
  requirement: RequirementEvidence,
  source: RequirementEvidenceSource,
  overrides: Partial<RequirementEvidence> = {},
): RequirementEvidence {
  return {
    ...requirement,
    source,
    audit: {
      ...requirement.audit,
      precedence: [source],
    },
    ...overrides,
  }
}

function buildPipelineAssessment(): JobCompatibilityAssessment {
  const base = buildCompatibilityAssessmentFixture({
    targetRole: 'Analytics Engineer',
    targetRoleConfidence: 'high',
    targetRoleSource: 'heuristic',
    catalog: {
      catalogIds: ['generic-taxonomy', 'data-bi'],
      catalogVersions: {
        'generic-taxonomy': '1.0.0',
        'data-bi': '1.2.0',
      },
    },
  })
  const supported = cloneRequirementWithSource(base.supportedRequirements[0]!, 'exact', {
    id: 'req-supported-exact',
    extractedSignals: ['SQL'],
  })
  const adjacent = cloneRequirementWithSource(base.adjacentRequirements[0]!, 'catalog_alias', {
    id: 'req-adjacent-catalog',
    extractedSignals: ['Power BI'],
  })
  const unsupported = cloneRequirementWithSource(base.unsupportedRequirements[0]!, 'llm_ambiguous', {
    id: 'req-unsupported-llm',
    extractedSignals: ['BigQuery'],
  })
  const fallback = cloneRequirementWithSource(base.unsupportedRequirements[0]!, 'fallback', {
    id: 'req-unsupported-fallback',
    extractedSignals: ['Stakeholder communication'],
  })
  const requirements = [supported, adjacent, unsupported, fallback]

  return {
    ...base,
    requirements,
    supportedRequirements: [supported],
    adjacentRequirements: [adjacent],
    unsupportedRequirements: [unsupported, fallback],
    claimPolicy: {
      allowedClaims: [{
        id: 'claim-supported-sql',
        signal: 'SQL',
        permission: 'allowed',
        evidenceBasis: [{ id: 'span-sql', text: 'SQL' }],
        allowedTerms: ['SQL'],
        prohibitedTerms: [],
        rationale: 'SQL is explicitly present in the CV fixture.',
        requirementIds: ['req-supported-exact'],
      }],
      cautiousClaims: [{
        id: 'claim-adjacent-data-storytelling',
        signal: 'Data storytelling',
        permission: 'cautious',
        verbalizationTemplate: 'Use related evidence: {allowedTerms}.',
        evidenceBasis: [{ id: 'span-data-storytelling', text: 'dashboard storytelling' }],
        allowedTerms: ['dashboard storytelling'],
        prohibitedTerms: ['Data storytelling expert'],
        rationale: 'Data storytelling is adjacent in the fixture assessment.',
        requirementIds: ['req-adjacent-catalog'],
      }],
      forbiddenClaims: [{
        id: 'claim-unsupported-bigquery',
        signal: 'BigQuery',
        permission: 'forbidden',
        evidenceBasis: [],
        allowedTerms: [],
        prohibitedTerms: ['BigQuery'],
        rationale: 'BigQuery is unsupported in the fixture assessment.',
        requirementIds: ['req-unsupported-llm'],
      }],
    },
    criticalGaps: [{
      id: 'gap-bigquery',
      signal: 'BigQuery',
      kind: 'platform',
      importance: 'core',
      severity: 'critical',
      rationale: 'No direct evidence.',
      requirementIds: ['req-unsupported-llm'],
      prohibitedTerms: ['BigQuery'],
    }],
    scoreBreakdown: {
      ...base.scoreBreakdown,
      total: 52,
      counts: {
        total: 4,
        supported: 1,
        adjacent: 1,
        unsupported: 2,
      },
    },
    lowFit: {
      ...base.lowFit,
      triggered: true,
      blocking: false,
      riskLevel: 'medium',
    },
    audit: {
      ...base.audit,
      assessmentVersion: 'job-compat-assessment-v1',
      scoreVersion: 'job-compat-score-v1',
      counters: {
        ...base.audit.counters,
        requirements: 4,
        supported: 1,
        adjacent: 1,
        unsupported: 2,
        criticalGaps: 1,
      },
    },
  }
}

function buildRewriteValidationResult(overrides: Record<string, unknown> = {}) {
  return {
    blocked: false,
    valid: true,
    hardIssues: [],
    softWarnings: [],
    issues: [],
    ...overrides,
  }
}

function buildSuccessfulRewriteOutput(cvState: CVState, section: string) {
  const traceItems = buildRewriteTraceItems(cvState, section)

  switch (section) {
    case 'summary':
      return {
        success: true,
        rewritten_content: `${cvState.summary} com foco em impacto.`,
        section_data: `${cvState.summary} com foco em impacto.`,
        keywords_added: ['SQL'],
        changes_made: ['Resumo fortalecido'],
        claim_trace_items: traceItems,
      }
    case 'experience':
      return {
        success: true,
        rewritten_content: 'Experiencia reestruturada.',
        section_data: cvState.experience,
        keywords_added: ['Power BI'],
        changes_made: ['Bullets consolidados'],
        claim_trace_items: traceItems,
      }
    case 'skills':
      return {
        success: true,
        rewritten_content: cvState.skills.join(', '),
        section_data: cvState.skills,
        keywords_added: [],
        changes_made: ['Skills agrupadas'],
        claim_trace_items: traceItems,
      }
    case 'education':
      return {
        success: true,
        rewritten_content: 'Educacao padronizada.',
        section_data: cvState.education,
        keywords_added: [],
        changes_made: ['Educacao padronizada'],
        claim_trace_items: traceItems,
      }
    default:
      return {
        success: true,
        rewritten_content: 'Certificacoes padronizadas.',
        section_data: cvState.certifications ?? [],
        keywords_added: [],
        changes_made: ['Certificacoes padronizadas'],
        claim_trace_items: traceItems,
      }
  }
}

function buildRewriteTraceItems(cvState: CVState, section: string): RewriteClaimTraceItem[] {
  switch (section) {
    case 'summary':
      return [{
        targetPath: 'summary',
        source: 'new_generated_text',
        usedClaimPolicyIds: ['claim-supported-sql'],
        expressedSignals: ['SQL'],
        evidenceBasis: ['SQL'],
        permissionLevel: 'allowed',
      }]
    case 'experience':
      return cvState.experience.flatMap((entry, entryIndex) => (
        entry.bullets.map((_bullet, bulletIndex) => ({
          targetPath: `experience.${entryIndex}.bullets.${bulletIndex}`,
          source: 'preserved_original' as const,
          usedClaimPolicyIds: [],
          expressedSignals: [],
          evidenceBasis: [],
          permissionLevel: 'preserved_original' as const,
        }))
      ))
    case 'skills':
      return cvState.skills.map((_skill, index) => ({
        targetPath: `skills.${index}`,
        source: 'preserved_original',
        usedClaimPolicyIds: [],
        expressedSignals: [],
        evidenceBasis: [],
        permissionLevel: 'preserved_original',
      }))
    case 'education':
      return cvState.education.map((_entry, index) => ({
        targetPath: `education.${index}`,
        source: 'preserved_original',
        usedClaimPolicyIds: [],
        expressedSignals: [],
        evidenceBasis: [],
        permissionLevel: 'preserved_original',
      }))
    case 'certifications':
      return (cvState.certifications ?? []).map((_entry, index) => ({
        targetPath: `certifications.${index}`,
        source: 'preserved_original',
        usedClaimPolicyIds: [],
        expressedSignals: [],
        evidenceBasis: [],
        permissionLevel: 'preserved_original',
      }))
    default:
      return []
  }
}

function buildHighlightDetectionOutcome(overrides: Partial<{
  resultKind: string
  itemCount: number
  rawModelItemCount: number
  rawModelRangeCount: number
  validatedItemCount: number
  validatedRangeCount: number
}> = {}) {
  return {
    resultKind: 'valid_empty',
    itemCount: 3,
    rawModelItemCount: 0,
    rawModelRangeCount: 0,
    validatedItemCount: 0,
    validatedRangeCount: 0,
    ...overrides,
  }
}

function buildHighlightStateFixture(params: {
  workflowMode?: 'ats_enhancement' | 'job_targeting'
  generatedAt?: string
  resolvedHighlights?: Array<{
    itemId: string
    section: 'summary' | 'experience'
    ranges: Array<{ start: number; end: number; reason: 'metric_impact' | 'business_impact' | 'action_result' | 'ats_strength' | 'tool_context' }>
  }>
} = {}) {
  const generatedAt = params.generatedAt ?? '2026-04-22T12:00:00.000Z'

  return {
    source: 'rewritten_cv_state' as const,
    version: 2 as const,
    highlightSource: params.workflowMode ?? 'ats_enhancement',
    highlightGeneratedAt: generatedAt,
    generatedAt,
    resolvedHighlights: params.resolvedHighlights ?? [],
  }
}

function buildOpenAIResponse(text: string) {
  return {
    choices: [{ message: { content: text } }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
    },
  }
}

describe('ATS enhancement reliability hardening', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('JOB_COMPATIBILITY_ASSESSMENT_ENABLED', 'true')
    vi.stubEnv('JOB_COMPATIBILITY_ASSESSMENT_SHADOW_MODE', 'false')
    vi.stubEnv('JOB_COMPATIBILITY_ASSESSMENT_SOURCE_OF_TRUTH', 'true')
    vi.stubEnv('JOB_COMPATIBILITY_ASSESSMENT_CUTOVER_APPROVED', 'true')
    resetOpenAICircuitBreakerForTest()
    mockUpdateSession.mockResolvedValue(undefined)
    mockCreateCvVersion.mockResolvedValue({
      id: 'ver_job_123',
      sessionId: 'sess_ats_123',
      snapshot: buildCvState(),
      source: 'job-targeting',
      createdAt: new Date('2026-04-22T12:00:00.000Z'),
    })
    mockCreateJobCompatibilityShadowComparison.mockResolvedValue(undefined)
    mockGenerateCvHighlightState.mockImplementation(async (_cvState, context) => {
      context?.onCompleted?.(buildHighlightDetectionOutcome())
      return buildHighlightStateFixture({
        workflowMode: context?.workflowMode === 'job_targeting' ? 'job_targeting' : 'ats_enhancement',
      })
    })
    mockValidateRewrite.mockReturnValue(buildRewriteValidationResult())
    mockEvaluateJobCompatibility.mockResolvedValue(buildPipelineAssessment())
    mockBuildTargetingPlan.mockReturnValue(buildDefaultTargetingPlan())
    mockBuildTargetedRewritePlan.mockReturnValue(buildDefaultTargetingPlan())
    mockDeriveTargetFitAssessment.mockReturnValue({
      level: 'medium',
      scoreLabel: 'Moderately aligned',
      confidence: 'high',
      reasons: ['Lacunas relevantes: BigQuery'],
      generatedAt: '2026-04-22T12:00:00.000Z',
    })
    mockAnalyzeGap.mockResolvedValue({
      output: {
        success: true,
        result: {
          matchScore: 68,
          missingSkills: ['BigQuery'],
          weakAreas: ['summary'],
          improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiência.'],
        },
      },
      result: {
        matchScore: 68,
        missingSkills: ['BigQuery'],
        weakAreas: ['summary'],
        improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiência.'],
      },
      repairAttempted: false,
    })
  })

  it('preserves rewrite section error code and failed section for batch diagnostics', async () => {
    mockRewriteSection.mockResolvedValue({
      output: {
        success: false,
        code: 'UNAUTHORIZED',
        error: 'Failed to rewrite resume section.',
      },
    })

    const result = await rewriteResumeFull({
      mode: 'job_targeting',
      cvState: buildCvState(),
      targetJobDescription: 'Cargo: Analytics Engineer\nRequisitos: SQL e BigQuery',
      gapAnalysis: {
        matchScore: 68,
        missingSkills: ['BigQuery'],
        weakAreas: ['summary'],
        improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiência.'],
      },
      targetingPlan: buildDefaultTargetingPlan(),
      jobCompatibilityAssessment: buildPipelineAssessment(),
      userId: 'shadow_batch',
      sessionId: 'shadow_case_debug',
    })

    expect(result).toEqual(expect.objectContaining({
      success: false,
      error: 'Failed to rewrite resume section.',
      errorCode: 'UNAUTHORIZED',
      failedSection: 'summary',
    }))
  })

  it('retries a malformed section rewrite and compacts large experience payloads', async () => {
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => {
      if (section === 'experience' && mockRewriteSection.mock.calls.filter(([input]: [{ section: string }]) => input.section === 'experience').length === 1) {
        return {
          output: {
            success: false,
            error: 'Invalid rewrite payload for section "experience".',
            code: 'LLM_INVALID_OUTPUT',
          },
        }
      }

      if (section === 'summary') {
        return {
          output: {
            success: true,
            rewritten_content: 'Analista de dados com foco em BI, SQL e automacao.',
            section_data: 'Analista de dados com foco em BI, SQL e automacao.',
            keywords_added: ['SQL'],
            changes_made: ['Resumo fortalecido'],
          },
        }
      }

      if (section === 'experience') {
        return {
          output: {
            success: true,
            rewritten_content: 'Experiencia reestruturada.',
            section_data: [{
              title: 'Analista de Dados',
              company: 'Acme',
              startDate: '2022',
              endDate: '2024',
              bullets: ['Estruturei dashboards e automacoes com Power BI e SQL.'],
            }],
            keywords_added: ['Power BI'],
            changes_made: ['Bullets consolidados'],
          },
        }
      }

      if (section === 'skills') {
        return {
          output: {
            success: true,
            rewritten_content: 'SQL, Power BI, ETL',
            section_data: ['SQL', 'Power BI', 'ETL'],
            keywords_added: [],
            changes_made: ['Skills agrupadas'],
          },
        }
      }

      if (section === 'education') {
        return {
          output: {
            success: true,
            rewritten_content: 'USP - Bacharel em Sistemas (2020)',
            section_data: [{ degree: 'Bacharel em Sistemas', institution: 'USP', year: '2020' }],
            keywords_added: [],
            changes_made: ['Educacao padronizada'],
          },
        }
      }

      return {
        output: {
          success: true,
          rewritten_content: 'AWS Cloud Practitioner - AWS (2024)',
          section_data: [{ name: 'AWS Cloud Practitioner', issuer: 'AWS', year: '2024' }],
          keywords_added: [],
          changes_made: ['Certificacao padronizada'],
        },
      }
    })

    const result = await rewriteResumeFull({
      mode: 'ats_enhancement',
      cvState: buildCvState(),
      atsAnalysis: {
        overallScore: 78,
        structureScore: 80,
        clarityScore: 77,
        impactScore: 74,
        keywordCoverageScore: 79,
        atsReadabilityScore: 82,
        issues: [],
        recommendations: ['Clareza', 'Power BI', 'SQL'],
      },
      userId: 'usr_123',
      sessionId: 'sess_ats_123',
    })

    expect(result.success).toBe(true)
    expect(result.diagnostics).toMatchObject({
      retriedSections: expect.arrayContaining(['experience']),
      compactedSections: ['experience'],
      sectionAttempts: expect.objectContaining({
        summary: 2,
        experience: 2,
        skills: 2,
      }),
    })
  })

  it('forces an assertive second pass when the summary rewrite stays too close to the original text', async () => {
    const cvState = buildCvState()

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => {
      if (section === 'summary') {
        const summaryCalls = mockRewriteSection.mock.calls.filter(([input]: [{ section: string }]) => input.section === 'summary').length

        return {
          output: {
            success: true,
            rewritten_content: summaryCalls === 1
              ? cvState.summary
              : 'Especialista em BI e dados com foco em SQL, Power BI e melhoria continua para analytics.',
            section_data: summaryCalls === 1
              ? cvState.summary
              : 'Especialista em BI e dados com foco em SQL, Power BI e melhoria continua para analytics.',
            keywords_added: ['SQL'],
            changes_made: ['Resumo reforcado'],
          },
        }
      }

      return {
        output: buildSuccessfulRewriteOutput(cvState, section),
      }
    })

    const result = await rewriteResumeFull({
      mode: 'ats_enhancement',
      cvState,
      atsAnalysis: {
        overallScore: 78,
        structureScore: 80,
        clarityScore: 77,
        impactScore: 74,
        keywordCoverageScore: 79,
        atsReadabilityScore: 82,
        issues: [],
        recommendations: ['Clareza', 'Power BI', 'SQL'],
      },
      userId: 'usr_123',
      sessionId: 'sess_ats_123',
    })

    expect(result.success).toBe(true)
    expect(result.optimizedCvState?.summary).toBe(
      'Especialista em BI e dados com foco em SQL, Power BI e melhoria continua para analytics.',
    )
    expect(result.diagnostics?.sectionAttempts.summary).toBe(2)
    expect(result.diagnostics?.retriedSections).toContain('summary')
  })

  it('forces an assertive second pass when the ATS summary still contains labels and repetitive phrasing', async () => {
    const cvState = buildCvState()

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => {
      if (section === 'summary') {
        const summaryCalls = mockRewriteSection.mock.calls.filter(([input]: [{ section: string }]) => input.section === 'summary').length

        return {
          output: {
            success: true,
            rewritten_content: summaryCalls === 1
              ? 'Resumo Profissional: Analytics Engineer com foco em SQL e Power BI. Analytics Engineer com foco em SQL e Power BI para analytics.'
              : 'Analytics Engineer com foco em SQL, Power BI e governanca analitica para decisoes executivas.',
            section_data: summaryCalls === 1
              ? 'Resumo Profissional: Analytics Engineer com foco em SQL e Power BI. Analytics Engineer com foco em SQL e Power BI para analytics.'
              : 'Analytics Engineer com foco em SQL, Power BI e governanca analitica para decisoes executivas.',
            keywords_added: ['SQL', 'Power BI'],
            changes_made: ['Resumo consolidado'],
          },
        }
      }

      return {
        output: buildSuccessfulRewriteOutput(cvState, section),
      }
    })

    const result = await rewriteResumeFull({
      mode: 'ats_enhancement',
      cvState,
      atsAnalysis: {
        overallScore: 78,
        structureScore: 80,
        clarityScore: 77,
        impactScore: 74,
        keywordCoverageScore: 79,
        atsReadabilityScore: 82,
        issues: [],
        recommendations: ['Clareza', 'Power BI', 'SQL'],
      },
      userId: 'usr_123',
      sessionId: 'sess_ats_123',
    })

    expect(result.success).toBe(true)
    expect(result.optimizedCvState?.summary).toBe(
      'Analytics Engineer com foco em SQL, Power BI e governanca analitica para decisoes executivas.',
    )
    expect(result.diagnostics?.sectionAttempts.summary).toBe(2)
    expect(result.diagnostics?.retriedSections).toContain('summary')
  })

  it('forces an assertive second pass when the ATS summary repeats the same domain and experience idea with weak first-line positioning', async () => {
    const cvState = buildCvState()

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => {
      if (section === 'summary') {
        const summaryCalls = mockRewriteSection.mock.calls.filter(([input]: [{ section: string }]) => input.section === 'summary').length

        return {
          output: {
            success: true,
            rewritten_content: summaryCalls === 1
              ? 'Profissional com mais de 8 anos em Business Intelligence. Experiencia em consultoria de Business Intelligence, desenvolvimento de Business Intelligence e atuacao em projetos corporativos.'
              : 'Especialista em Business Intelligence e engenharia de dados com foco em SQL, Power BI e governanca analitica. Atua em ambientes corporativos com traducao de indicadores em decisoes de negocio.',
            section_data: summaryCalls === 1
              ? 'Profissional com mais de 8 anos em Business Intelligence. Experiencia em consultoria de Business Intelligence, desenvolvimento de Business Intelligence e atuacao em projetos corporativos.'
              : 'Especialista em Business Intelligence e engenharia de dados com foco em SQL, Power BI e governanca analitica. Atua em ambientes corporativos com traducao de indicadores em decisoes de negocio.',
            keywords_added: ['SQL', 'Power BI'],
            changes_made: ['Resumo endurecido editorialmente'],
          },
        }
      }

      return {
        output: buildSuccessfulRewriteOutput(cvState, section),
      }
    })

    const result = await rewriteResumeFull({
      mode: 'ats_enhancement',
      cvState,
      atsAnalysis: {
        overallScore: 78,
        structureScore: 80,
        clarityScore: 77,
        impactScore: 74,
        keywordCoverageScore: 79,
        atsReadabilityScore: 82,
        issues: [],
        recommendations: ['Clareza', 'Power BI', 'SQL'],
      },
      userId: 'usr_123',
      sessionId: 'sess_ats_123',
    })

    expect(result.success).toBe(true)
    expect(result.optimizedCvState?.summary).toBe(
      'Especialista em Business Intelligence e engenharia de dados com foco em SQL, Power BI e governanca analitica. Atua em ambientes corporativos com traducao de indicadores em decisoes de negocio.',
    )
    expect(result.diagnostics?.sectionAttempts.summary).toBe(2)
    expect(result.diagnostics?.retriedSections).toContain('summary')
  })

  it('keeps a dense two-sentence ATS summary when the second sentence adds new stack and impact context', async () => {
    const cvState = buildCvState()
    const denseSummary = 'Especialista em Business Intelligence e engenharia de dados com foco em SQL, Power BI e automacao analitica. Atua em ambientes corporativos com dashboards executivos, ETL e traducao de indicadores em decisoes de negocio.'

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: section === 'summary'
        ? {
            success: true,
            rewritten_content: denseSummary,
            section_data: denseSummary,
            keywords_added: ['SQL', 'Power BI', 'ETL'],
            changes_made: ['Resumo denso e consolidado'],
          }
        : buildSuccessfulRewriteOutput(cvState, section),
    }))

    const result = await rewriteResumeFull({
      mode: 'ats_enhancement',
      cvState,
      atsAnalysis: {
        overallScore: 78,
        structureScore: 80,
        clarityScore: 77,
        impactScore: 74,
        keywordCoverageScore: 79,
        atsReadabilityScore: 82,
        issues: [],
        recommendations: ['Clareza', 'Power BI', 'SQL'],
      },
      userId: 'usr_123',
      sessionId: 'sess_ats_123',
    })

    expect(result.success).toBe(true)
    expect(result.optimizedCvState?.summary).toBe(denseSummary)
    expect(result.diagnostics?.sectionAttempts.summary).toBe(1)
    expect(result.diagnostics?.retriedSections).not.toContain('summary')
  })

  it('keeps an additive ATS summary even when the main domain appears in both sentences', async () => {
    const cvState = buildCvState()
    const summary = 'Especialista em engenharia de dados com foco em SQL, Power BI e automacao analitica. Atua em engenharia de dados para governanca, dashboards executivos e decisoes de negocio.'

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: section === 'summary'
        ? {
            success: true,
            rewritten_content: summary,
            section_data: summary,
            keywords_added: ['SQL', 'Power BI'],
            changes_made: ['Resumo denso e aditivo'],
          }
        : buildSuccessfulRewriteOutput(cvState, section),
    }))

    const result = await rewriteResumeFull({
      mode: 'ats_enhancement',
      cvState,
      atsAnalysis: {
        overallScore: 78,
        structureScore: 80,
        clarityScore: 77,
        impactScore: 74,
        keywordCoverageScore: 79,
        atsReadabilityScore: 82,
        issues: [],
        recommendations: ['Clareza', 'Power BI', 'SQL'],
      },
      userId: 'usr_123',
      sessionId: 'sess_ats_123',
    })

    expect(result.success).toBe(true)
    expect(result.optimizedCvState?.summary).toBe(summary)
    expect(result.diagnostics?.sectionAttempts.summary).toBe(1)
  })

  it('Contract 7: no-target ATS summary cannot contain internal section labels', async () => {
    const cvState = buildCvState()

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => {
      if (section === 'summary') {
        const summaryCalls = mockRewriteSection.mock.calls.filter(([input]: [{ section: string }]) => input.section === 'summary').length

        return {
          output: {
            success: true,
            rewritten_content: summaryCalls === 1
              ? 'Professional Summary: Analytics Engineer com foco em SQL e Power BI.'
              : 'Analytics Engineer com foco em SQL, Power BI e governanca analitica para decisoes executivas.',
            section_data: summaryCalls === 1
              ? 'Professional Summary: Analytics Engineer com foco em SQL e Power BI.'
              : 'Analytics Engineer com foco em SQL, Power BI e governanca analitica para decisoes executivas.',
            keywords_added: ['SQL', 'Power BI'],
            changes_made: ['Resumo consolidado'],
          },
        }
      }

      return {
        output: buildSuccessfulRewriteOutput(cvState, section),
      }
    })

    const result = await rewriteResumeFull({
      mode: 'ats_enhancement',
      cvState,
      atsAnalysis: {
        overallScore: 78,
        structureScore: 80,
        clarityScore: 77,
        impactScore: 74,
        keywordCoverageScore: 79,
        atsReadabilityScore: 82,
        issues: [],
        recommendations: ['Clareza', 'Power BI', 'SQL'],
      },
      userId: 'usr_123',
      sessionId: 'sess_ats_123',
    })

    expect(result.success).toBe(true)
    expect(result.optimizedCvState?.summary).toBe(
      'Analytics Engineer com foco em SQL, Power BI e governanca analitica para decisoes executivas.',
    )
    expect(result.optimizedCvState?.summary.includes('Professional Summary:')).toBe(false)
    expect(result.optimizedCvState?.summary.includes('Resumo Profissional:')).toBe(false)
  })

  it('forces an assertive second pass when ATS summary cleanup would leave the summary empty', async () => {
    const cvState = buildCvState()

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => {
      if (section === 'summary') {
        const summaryCalls = mockRewriteSection.mock.calls.filter(([input]: [{ section: string }]) => input.section === 'summary').length

        return {
          output: {
            success: true,
            rewritten_content: summaryCalls === 1
              ? 'Resumo Profissional:'
              : 'Analytics Engineer com foco em SQL, BI e governanca analitica orientada a decisao.',
            section_data: summaryCalls === 1
              ? 'Resumo Profissional:'
              : 'Analytics Engineer com foco em SQL, BI e governanca analitica orientada a decisao.',
            keywords_added: ['SQL'],
            changes_made: ['Resumo consolidado'],
          },
        }
      }

      return {
        output: buildSuccessfulRewriteOutput(cvState, section),
      }
    })

    const result = await rewriteResumeFull({
      mode: 'ats_enhancement',
      cvState,
      atsAnalysis: {
        overallScore: 78,
        structureScore: 80,
        clarityScore: 77,
        impactScore: 74,
        keywordCoverageScore: 79,
        atsReadabilityScore: 82,
        issues: [],
        recommendations: ['Clareza', 'Power BI', 'SQL'],
      },
      userId: 'usr_123',
      sessionId: 'sess_ats_123',
    })

    expect(result.success).toBe(true)
    expect(result.optimizedCvState?.summary).toBe(
      'Analytics Engineer com foco em SQL, BI e governanca analitica orientada a decisao.',
    )
    expect(result.diagnostics?.sectionAttempts.summary).toBe(2)
    expect(result.diagnostics?.retriedSections).toContain('summary')
  })

  it('passes deeper ATS rewrite instructions that preserve detail instead of over-compressing the resume', async () => {
    const cvState = buildCvState()

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput(cvState, section),
    }))

    const result = await rewriteResumeFull({
      mode: 'ats_enhancement',
      cvState,
      atsAnalysis: {
        overallScore: 78,
        structureScore: 80,
        clarityScore: 77,
        impactScore: 74,
        keywordCoverageScore: 79,
        atsReadabilityScore: 82,
        issues: [],
        recommendations: ['Clareza', 'Power BI', 'SQL'],
      },
      userId: 'usr_123',
      sessionId: 'sess_ats_123',
    })

    expect(result.success).toBe(true)

    const summaryCall = mockRewriteSection.mock.calls.find(([input]: [{ section: string }]) => input.section === 'summary')?.[0]
    const experienceCall = mockRewriteSection.mock.calls.find(([input]: [{ section: string }]) => input.section === 'experience')?.[0]
    const skillsCall = mockRewriteSection.mock.calls.find(([input]: [{ section: string }]) => input.section === 'skills')?.[0]

    expect(summaryCall?.instructions).toContain('Apply every resume rewrite guardrail rigorously before making any improvement.')
    expect(summaryCall?.instructions).toContain('Sua missão principal é melhorar o currículo SEM NUNCA piorá-lo')
    expect(summaryCall?.instructions).toContain('Use 1 strong opening sentence plus 1 optional complementary sentence')
    expect(summaryCall?.instructions).toContain('The first sentence must lead with professional identity, seniority, and main functional focus')
    expect(summaryCall?.instructions).toContain('Do not repeat the same domain, role family, or experience idea across consecutive sentences')
    expect(summaryCall?.instructions).toContain('do not flatten the profile into generic claims')
    expect(experienceCall?.instructions).toContain('Prefira clareza com densidade a brevidade excessiva.')
    expect(experienceCall?.instructions).toContain('Every bullet must start with a strong action verb in pt-BR')
    expect(experienceCall?.instructions).toContain('Do not merge, trim, or generalize bullets')
    expect(skillsCall?.instructions).toContain('do not replace specific tools, platforms, or methods with vague umbrella labels')
  })

  it('populates keyword visibility improvement in ats_enhancement when stack terms become more visible across summary, skills, and experience', async () => {
    const cvState = buildCvState()

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => {
      if (section === 'summary') {
        return {
          output: {
            success: true,
            rewritten_content: 'Analista de dados com foco em SQL, Power BI e ETL para indicadores executivos.',
            section_data: 'Analista de dados com foco em SQL, Power BI e ETL para indicadores executivos.',
            keywords_added: ['SQL', 'Power BI', 'ETL'],
            changes_made: ['Resumo reforcado'],
          },
        }
      }

      if (section === 'experience') {
        return {
          output: {
            success: true,
            rewritten_content: 'Experiencia reestruturada.',
            section_data: [{
              title: 'Analista de Dados',
              company: 'Acme',
              startDate: '2022',
              endDate: '2024',
              bullets: ['Estruturei dashboards em SQL e Power BI com automacoes ETL para indicadores executivos.'],
            }],
            keywords_added: ['SQL', 'Power BI', 'ETL'],
            changes_made: ['Bullets fortalecidos'],
          },
        }
      }

      return {
        output: buildSuccessfulRewriteOutput(cvState, section),
      }
    })

    const result = await rewriteResumeFull({
      mode: 'ats_enhancement',
      cvState,
      atsAnalysis: {
        overallScore: 78,
        structureScore: 80,
        clarityScore: 77,
        impactScore: 74,
        keywordCoverageScore: 79,
        atsReadabilityScore: 82,
        issues: [],
        recommendations: ['SQL', 'Power BI', 'ETL'],
      },
      userId: 'usr_123',
      sessionId: 'sess_ats_123',
    })

    expect(result.success).toBe(true)
    expect(result.summary?.keywordCoverageImprovement).toEqual(
      expect.arrayContaining(['SQL', 'Power BI', 'ETL']),
    )
  })

  it('persists stage-aware ATS workflow metadata and logs completion', async () => {
    const session = buildSession()
    const originalSummary = session.cvState.summary
    const optimizedCvState = {
      ...buildCvState(),
      summary: 'Analista de dados com foco em BI, SQL e automacao orientada a impacto.',
    }

    mockAnalyzeAtsGeneral.mockResolvedValue({
      success: true,
      result: {
        overallScore: 80,
        structureScore: 82,
        clarityScore: 78,
        impactScore: 76,
        keywordCoverageScore: 81,
        atsReadabilityScore: 84,
        issues: [],
        recommendations: ['SQL', 'Power BI'],
      },
    })

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput(optimizedCvState, section),
    }))

    const result = await runAtsEnhancementPipeline(session)

    expect(result.success).toBe(true)
    expect(session.cvState.summary).toBe(originalSummary)
    expect(session.agentState.optimizedCvState?.summary).toContain('Analista de dados com foco em BI')
    expect(session.agentState.optimizedCvState?.summary).not.toBe(originalSummary)
    expect(session.agentState.atsWorkflowRun).toMatchObject({
      status: 'completed',
      currentStage: 'persist_version',
    })
    expect(mockCreateCvVersion).toHaveBeenCalledTimes(1)
    expect(mockGenerateCvHighlightState).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.stringContaining('Analista de dados com foco em BI'),
      }),
      expect.objectContaining({
        userId: session.userId,
        sessionId: session.id,
        workflowMode: 'ats_enhancement',
      }),
    )
    expect(session.agentState.highlightState).toEqual(buildHighlightStateFixture())
    expect(mockLogInfo).toHaveBeenCalledWith('agent.ats_enhancement.started', expect.any(Object))
    const summaryOutcomeCalls = mockLogInfo.mock.calls.filter(([event]) => event === 'agent.ats_enhancement.summary_clarity_outcome')
    expect(summaryOutcomeCalls).toHaveLength(1)
    expect(summaryOutcomeCalls[0]?.[1]).toMatchObject({
      sessionId: session.id,
      userId: session.userId,
      workflowMode: 'ats_enhancement',
      summaryValidationRecovered: false,
      summaryRecoveryKind: null,
      summaryRecoveryWasSmartRepair: false,
      summaryClarityGateFailed: false,
      summaryRepairThenClarityFail: false,
      estimatedRangeOutcome: expect.any(Boolean),
      usedExactScore: expect.any(Boolean),
    })
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.persisted', expect.objectContaining({
      workflowMode: 'ats_enhancement',
      highlightDetectionInvoked: true,
      highlightStateGenerated: true,
      highlightStatePersisted: true,
      highlightStatePersistedReason: 'empty_valid_result',
      highlightStateResultKind: 'valid_empty',
      highlightStateResolvedRangeCount: 0,
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.ats_enhancement.completed', expect.objectContaining({
      workflowMode: 'ats_enhancement',
      success: true,
    }))
  })

  it('falls back to a safe ATS version instead of aborting when summary or skills coherence fails', async () => {
    const session = buildSession()

    mockAnalyzeAtsGeneral.mockResolvedValue({
      success: true,
      result: {
        overallScore: 80,
        structureScore: 82,
        clarityScore: 78,
        impactScore: 76,
        keywordCoverageScore: 81,
        atsReadabilityScore: 84,
        issues: [],
        recommendations: ['SQL'],
      },
    })

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: section === 'summary'
        ? {
            success: true,
            rewritten_content: 'Resumo com Power Query e Looker Studio sem suporte.',
            section_data: 'Resumo com Power Query e Looker Studio sem suporte.',
            keywords_added: [],
            changes_made: ['Resumo ajustado'],
          }
        : section === 'skills'
          ? {
              success: true,
              rewritten_content: 'SQL, Power BI, ETL, Looker Studio',
              section_data: ['SQL', 'Power BI', 'ETL', 'Looker Studio'],
              keywords_added: [],
              changes_made: ['Skills agrupadas'],
            }
        : buildSuccessfulRewriteOutput(buildCvState(), section),
    }))

    mockValidateRewrite
      .mockReturnValueOnce({
        valid: false,
        issues: [
          { severity: 'medium', message: 'A lista de skills otimizada introduziu habilidade ou ferramenta sem base no currículo original.', section: 'skills' },
      { severity: 'medium', message: 'O resumo otimizado menciona skill sem evidência no currículo original.', section: 'summary' },
        ],
      })
      .mockReturnValueOnce({
        valid: true,
        issues: [],
      })

    const result = await runAtsEnhancementPipeline(session)

    expect(result.success).toBe(true)
    expect(session.agentState.optimizedCvState).toBeDefined()
    expect(session.agentState.optimizedCvState?.summary).toBe('Resumo com Power Query e Looker Studio sem suporte.')
    expect(session.agentState.optimizedCvState?.skills).toEqual(buildCvState().skills)
    expect(session.agentState.rewriteStatus).toBe('completed')
    expect(session.agentState.atsWorkflowRun).toMatchObject({
      status: 'completed',
      currentStage: 'persist_version',
    })
    expect(mockCreateCvVersion).toHaveBeenCalledTimes(1)
    expect(mockLogInfo).toHaveBeenCalledWith('agent.ats_enhancement.validation_recovered', expect.objectContaining({
      workflowMode: 'ats_enhancement',
      recoveryKind: 'smart_repair',
    }))
    expect(mockGenerateCvHighlightState).toHaveBeenCalledTimes(1)
    const summaryOutcomeCalls = mockLogInfo.mock.calls.filter(([event]) => event === 'agent.ats_enhancement.summary_clarity_outcome')
    expect(summaryOutcomeCalls).toHaveLength(1)
    expect(summaryOutcomeCalls[0]?.[1]).toMatchObject({
      sessionId: session.id,
      userId: session.userId,
      workflowMode: 'ats_enhancement',
      summaryValidationRecovered: true,
      summaryRecoveryKind: 'smart_repair',
      summaryRecoveryWasSmartRepair: true,
      summaryWasTouchedByRewrite: true,
      estimatedRangeOutcome: expect.any(Boolean),
      usedExactScore: expect.any(Boolean),
    })
    expect(mockLogInfo).toHaveBeenCalledWith('agent.ats_enhancement.completed', expect.objectContaining({
      workflowMode: 'ats_enhancement',
      success: true,
      issueCount: 0,
      recoveredIssueCount: 2,
      recoveredIssueSections: 'skills, summary',
    }))
  })

  it('emits a strict smart-repair-then-clarity-fail summary outcome only after final score fields are known', async () => {
    const session = buildSession()

    mockAnalyzeAtsGeneral.mockResolvedValue({
      success: true,
      result: {
        overallScore: 80,
        structureScore: 82,
        clarityScore: 78,
        impactScore: 76,
        keywordCoverageScore: 81,
        atsReadabilityScore: 84,
        issues: [],
        recommendations: ['SQL', 'Power BI'],
      },
    })

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: section === 'summary'
        ? {
            success: true,
            rewritten_content: 'Resumo Profissional: Analista de dados com foco em SQL e Power BI para analytics.',
            section_data: 'Resumo Profissional: Analista de dados com foco em SQL e Power BI para analytics.',
            keywords_added: ['SQL'],
            changes_made: ['Resumo alterado'],
          }
        : buildSuccessfulRewriteOutput(buildCvState(), section),
    }))

    mockValidateRewrite
      .mockReturnValueOnce({
        valid: false,
        issues: [{
          severity: 'medium',
          message: 'O resumo otimizado ainda exige reparo factual antes da validação final.',
          section: 'summary',
        }],
      })
      .mockReturnValueOnce({
        valid: true,
        issues: [],
      })

    const result = await runAtsEnhancementPipeline(session)

    expect(result.success).toBe(true)
    const summaryOutcomeCalls = mockLogWarn.mock.calls.filter(([event]) => event === 'agent.ats_enhancement.summary_clarity_outcome')
    expect(summaryOutcomeCalls).toHaveLength(1)
    expect(summaryOutcomeCalls[0]?.[1]).toMatchObject({
      sessionId: session.id,
      userId: session.userId,
      workflowMode: 'ats_enhancement',
      scoreStatus: 'estimated_range',
      confidence: expect.any(String),
      summaryValidationRecovered: true,
      summaryRecoveryKind: 'smart_repair',
      summaryRecoveryWasSmartRepair: true,
      gateImprovedSummaryClarity: false,
      summaryClarityGateFailed: true,
      summaryRepairThenClarityFail: true,
      withheldForSummaryClarity: true,
      estimatedRangeOutcome: true,
      usedExactScore: false,
      withholdReasons: expect.any(String),
      withholdReasonCount: expect.any(Number),
    })
  })

  it('falls back to the original cvState when ATS validation still fails after recovery attempts', async () => {
    const session = buildSession()
    const previousOptimizedCvState = {
      ...buildCvState(),
      summary: 'Resumo otimizado anterior e estavel.',
      skills: ['SQL', 'Power BI', 'ETL'],
    }

    session.agentState.optimizedCvState = previousOptimizedCvState
    session.agentState.optimizedAt = '2026-04-10T12:00:00.000Z'
    session.agentState.optimizationSummary = {
      changedSections: ['summary'],
      notes: ['Versao anterior validada'],
      keywordCoverageImprovement: ['SQL'],
    }
    session.agentState.lastRewriteMode = 'ats_enhancement'

    mockAnalyzeAtsGeneral.mockResolvedValue({
      success: true,
      result: {
        overallScore: 80,
        structureScore: 82,
        clarityScore: 78,
        impactScore: 76,
        keywordCoverageScore: 81,
        atsReadabilityScore: 84,
        issues: [],
        recommendations: ['SQL', 'Power BI'],
      },
    })

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Novo resumo ATS com claims inconsistentes.',
      }, section),
    }))

    mockValidateRewrite.mockReturnValue({
      valid: false,
      issues: [{
        severity: 'medium',
      message: 'O resumo permanece inconsistente com a experiência comprovada.',
        section: 'summary',
      }],
    })

    const result = await runAtsEnhancementPipeline(session)

    expect(result.success).toBe(true)
    expect(session.agentState.optimizedCvState).toEqual(session.cvState)
    expect(session.agentState.optimizedAt).not.toBe('2026-04-10T12:00:00.000Z')
    expect(session.agentState.optimizationSummary).toEqual(expect.objectContaining({
      changedSections: [],
      keywordCoverageImprovement: [],
    }))
    expect(session.agentState.optimizationSummary?.notes).toContain(
      'Falha na validação ATS; a plataforma entregou a base original para evitar bloqueio da geração.',
    )
    expect(session.agentState.lastRewriteMode).toBe('ats_enhancement')
    expect(session.agentState.atsWorkflowRun).toMatchObject({
      status: 'completed',
      currentStage: 'persist_version',
      lastFailureStage: undefined,
    })
    expect(mockCreateCvVersion).toHaveBeenCalledTimes(1)
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.persisted', expect.objectContaining({
      workflowMode: 'ats_enhancement',
      highlightDetectionInvoked: false,
      highlightStateGenerated: false,
      highlightStatePersisted: false,
      highlightStatePersistedReason: 'not_generated_for_original_fallback',
    }))
  })

  it('does not generate highlight artifacts when ATS recovery falls back to the original cvState', async () => {
    const session = buildSession()

    mockAnalyzeAtsGeneral.mockResolvedValue({
      success: true,
      result: {
        overallScore: 80,
        structureScore: 82,
        clarityScore: 78,
        impactScore: 76,
        keywordCoverageScore: 81,
        atsReadabilityScore: 84,
        issues: [],
        recommendations: ['SQL', 'Power BI'],
      },
    })

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: section === 'summary'
        ? {
            success: true,
            rewritten_content: 'Resumo com claims sem suporte.',
            section_data: 'Resumo com claims sem suporte.',
            keywords_added: [],
            changes_made: ['Resumo ajustado'],
          }
        : buildSuccessfulRewriteOutput(buildCvState(), section),
    }))

    mockValidateRewrite
      .mockReturnValueOnce({
        valid: false,
        issues: [{ severity: 'medium', message: 'Resumo sem suporte.', section: 'summary' }],
      })
      .mockReturnValueOnce({
        valid: false,
        issues: [{ severity: 'medium', message: 'Resumo ainda sem suporte.', section: 'summary' }],
      })
      .mockReturnValueOnce({
        valid: false,
        issues: [{ severity: 'medium', message: 'Fallback conservador insuficiente.', section: 'summary' }],
      })

    const result = await runAtsEnhancementPipeline(session)

    expect(result.success).toBe(true)
    expect(session.agentState.optimizedCvState).toEqual(session.cvState)
    expect(session.agentState.highlightState).toBeUndefined()
    expect(mockGenerateCvHighlightState).not.toHaveBeenCalled()
    expect(mockLogInfo).toHaveBeenCalledWith('agent.ats_enhancement.validation_recovered', expect.objectContaining({
      workflowMode: 'ats_enhancement',
      recoveryKind: 'original_cv_fallback',
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.persisted', expect.objectContaining({
      workflowMode: 'ats_enhancement',
      highlightDetectionInvoked: false,
      highlightStateGenerated: false,
      highlightStatePersisted: false,
      highlightStatePersistedReason: 'not_generated_for_original_fallback',
    }))
    expect(mockValidateRewrite).toHaveBeenCalledTimes(3)
  })

  it('persists a separate highlight artifact after a successful ATS rewrite', async () => {
    const session = buildSession()
    session.cvState.experience = [{
      title: 'Senior Business Intelligence',
      company: 'Grupo Positivo',
      startDate: '2025',
      endDate: 'present',
      bullets: ['Aumentei em 15% os indicadores de qualidade de produção na LATAM com dashboards e governança analítica.'],
    }]

    mockAnalyzeAtsGeneral.mockResolvedValue({
      success: true,
      result: {
        overallScore: 80,
        structureScore: 82,
        clarityScore: 78,
        impactScore: 76,
        keywordCoverageScore: 81,
        atsReadabilityScore: 84,
        issues: [],
        recommendations: ['SQL', 'Power BI'],
      },
    })

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: section === 'experience'
        ? {
            success: true,
            rewritten_content: 'Experiência reestruturada.',
            section_data: [{
              title: 'Senior Business Intelligence',
              company: 'Grupo Positivo',
              startDate: '2025',
              endDate: 'present',
              bullets: ['Atuei em dashboards estratégicos para qualidade e acompanhamento operacional.'],
            }],
            keywords_added: ['dashboards'],
            changes_made: ['Bullets alinhados à vaga'],
          }
        : buildSuccessfulRewriteOutput(buildCvState(), section),
    }))
    mockGenerateCvHighlightState.mockImplementation(async (_cvState, context) => {
      context?.onCompleted?.(buildHighlightDetectionOutcome({
        resultKind: 'valid_non_empty',
        rawModelItemCount: 1,
        rawModelRangeCount: 1,
        validatedItemCount: 1,
        validatedRangeCount: 1,
      }))
      return buildHighlightStateFixture({
        workflowMode: 'ats_enhancement',
        resolvedHighlights: [{
          itemId: 'summary_0',
          section: 'summary',
          ranges: [{ start: 0, end: 18, reason: 'metric_impact' }],
        }],
      })
    })

    const result = await runAtsEnhancementPipeline(session)

    expect(result.success).toBe(true)
    expect(session.agentState.optimizedCvState?.experience).toEqual([{
      title: 'Senior Business Intelligence',
      company: 'Grupo Positivo',
      startDate: '2025',
      endDate: 'present',
      bullets: ['Atuei em dashboards estratégicos para qualidade e acompanhamento operacional.'],
    }])
    expect(mockGenerateCvHighlightState).toHaveBeenCalledTimes(1)
    expect(mockGenerateCvHighlightState).toHaveBeenCalledWith(
      expect.objectContaining({
        experience: expect.arrayContaining([
          expect.objectContaining({
            company: 'Grupo Positivo',
          }),
        ]),
      }),
      expect.objectContaining({
        sessionId: session.id,
        userId: session.userId,
        workflowMode: 'ats_enhancement',
      }),
    )
    expect(session.agentState.highlightState).toEqual(buildHighlightStateFixture({
      workflowMode: 'ats_enhancement',
      resolvedHighlights: [{
        itemId: 'summary_0',
        section: 'summary',
        ranges: [{ start: 0, end: 18, reason: 'metric_impact' }],
      }],
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.persisted', expect.objectContaining({
      workflowMode: 'ats_enhancement',
      highlightStatePersistedReason: 'generated',
      highlightStateResultKind: 'valid_non_empty',
      highlightStateResolvedItemCount: 1,
      highlightStateResolvedRangeCount: 1,
    }))
  })

  it('builds a full job_targeting rewrite with plan-driven keyword emphasis', async () => {
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Analytics engineer com foco em SQL, Power BI e BigQuery para suportar decisoes de negocio.',
        skills: ['SQL', 'Power BI', 'BigQuery'],
      }, section),
    }))

    const result = await rewriteResumeFull({
      mode: 'job_targeting',
      cvState: buildCvState(),
      targetJobDescription: [
        'Cargo: Analytics Engineer',
        'Responsabilidades: construir modelos, dashboards e analises em BigQuery.',
        'Requisitos: SQL, BigQuery, comunicacao com negocio.',
      ].join('\n'),
      gapAnalysis: {
        matchScore: 68,
        missingSkills: ['BigQuery'],
        weakAreas: ['summary'],
        improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiência.'],
      },
      targetingPlan: {
        targetRole: 'Analytics Engineer',
        targetRoleConfidence: 'high',
        targetRoleSource: 'heuristic',
        focusKeywords: ['sql', 'bigquery'],
        mustEmphasize: ['SQL', 'BigQuery'],
        shouldDeemphasize: ['ETL'],
        missingButCannotInvent: ['BigQuery'],
        sectionStrategy: {
          summary: ['Aproxime o posicionamento do cargo alvo sem afirmar dominio inexistente.'],
          experience: ['Priorize contexto analitico e stack relevante.'],
          skills: ['Reordene por aderencia a vaga.'],
          education: ['Mantenha factual.'],
          certifications: ['Destaque somente o que ajuda na vaga.'],
        },
      },
      userId: 'usr_123',
      sessionId: 'sess_job_123',
    })

    expect(result.success).toBe(true)
    expect(result.optimizedCvState?.skills).toEqual(['SQL', 'Power BI', 'ETL'])
    expect(result.summary).toMatchObject({
      changedSections: ['summary', 'experience', 'skills', 'education', 'certifications'],
      keywordCoverageImprovement: ['SQL', 'BigQuery'],
    })
  })

  it('does not inject targeted semantic permission buckets into generic ATS rewrite instructions', async () => {
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput(buildCvState(), section),
    }))

    await rewriteResumeFull({
      mode: 'ats_enhancement',
      cvState: buildCvState(),
      atsAnalysis: {
        overallScore: 78,
        structureScore: 80,
        clarityScore: 77,
        impactScore: 74,
        keywordCoverageScore: 79,
        atsReadabilityScore: 82,
        issues: [],
        recommendations: ['Clareza', 'Power BI', 'SQL'],
      },
      userId: 'usr_123',
      sessionId: 'sess_ats_123',
    })

    const summaryCall = mockRewriteSection.mock.calls.find(([input]: [{ section: string }]) => input.section === 'summary')
    expect(summaryCall?.[0].instructions).not.toContain('Direct claims allowed:')
    expect(summaryCall?.[0].instructions).not.toContain('Forbidden claims:')
    expect(summaryCall?.[0].instructions).not.toContain('Bridge carefully only when anchored in real evidence:')
    expect(summaryCall?.[0].instructions).not.toContain('Prioritize these proven aligned signals:')
    expect(summaryCall?.[0].instructions).not.toContain('Preferred cautious bridge wording:')
  })

  it('keeps ATS highlight generation isolated from the targeted semantic layer', async () => {
    const session = buildSession()

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput(buildCvState(), section),
    }))

    const result = await runAtsEnhancementPipeline(session)

    expect(result.success).toBe(true)
    expect(mockBuildTargetingPlan).not.toHaveBeenCalled()
    expect(mockBuildTargetedRewritePlan).not.toHaveBeenCalled()
    expect(mockGenerateCvHighlightState).toHaveBeenCalledWith(
      expect.any(Object),
      expect.not.objectContaining({
        jobKeywords: expect.anything(),
      }),
    )
    expect(mockLogInfo).not.toHaveBeenCalledWith(
      'agent.job_targeting.low_fit_gate.evaluated',
      expect.anything(),
    )
  })

  it('passes evidence-aware permission buckets into the targeted rewrite prompt', async () => {
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput(buildCvState(), section),
    }))

    await rewriteResumeFull({
      mode: 'job_targeting',
      cvState: buildCvState(),
      targetJobDescription: [
        'Cargo: Analytics Engineer',
        'Requisitos: SQL, BigQuery e comunicacao com negocio.',
      ].join('\n'),
      gapAnalysis: {
        matchScore: 68,
        missingSkills: ['BigQuery'],
        weakAreas: ['summary'],
        improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiência.'],
      },
      targetingPlan: buildDefaultTargetingPlan(),
      userId: 'usr_123',
      sessionId: 'sess_job_123',
    })

    const summaryCall = mockRewriteSection.mock.calls.find(([input]: [{ section: string }]) => input.section === 'summary')
    expect(summaryCall?.[0].instructions).toContain('Direct claims allowed: SQL.')
    expect(summaryCall?.[0].instructions).toContain('Forbidden claims: BigQuery.')
    expect(summaryCall?.[0].instructions).toContain('Skills section is strict.')
  })

  it('uses the enriched targeted plan builder for job_targeting rewrite fallback only', async () => {
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput(buildCvState(), section),
    }))

    const result = await rewriteResumeFull({
      mode: 'job_targeting',
      cvState: buildCvState(),
      targetJobDescription: [
        'Cargo: Analytics Engineer',
        'Requisitos: SQL, BigQuery e comunicacao com negocio.',
      ].join('\n'),
      gapAnalysis: {
        matchScore: 68,
        missingSkills: ['BigQuery'],
        weakAreas: ['summary'],
        improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiência.'],
      },
      userId: 'usr_123',
      sessionId: 'sess_job_123',
    })

    expect(result.success).toBe(true)
    expect(mockBuildTargetedRewritePlan).toHaveBeenCalledTimes(1)
    expect(mockBuildTargetingPlan).not.toHaveBeenCalled()
    expect(mockBuildTargetedRewritePlan).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'job_targeting',
      rewriteIntent: 'targeted_rewrite',
    }))
  })

  it('does not use the enriched targeted plan builder in ATS rewrite mode', async () => {
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput(buildCvState(), section),
    }))

    const result = await rewriteResumeFull({
      mode: 'ats_enhancement',
      cvState: buildCvState(),
      atsAnalysis: {
        overallScore: 78,
        structureScore: 80,
        clarityScore: 77,
        impactScore: 74,
        keywordCoverageScore: 79,
        atsReadabilityScore: 82,
        issues: [],
        recommendations: ['Clareza', 'Power BI', 'SQL'],
      },
      userId: 'usr_123',
      sessionId: 'sess_ats_123',
    })

    expect(result.success).toBe(true)
    expect(mockBuildTargetedRewritePlan).not.toHaveBeenCalled()
    expect(mockBuildTargetingPlan).not.toHaveBeenCalled()
  })

  it('allows a normalized/equivalent targeted skill to survive sanitization when the plan explicitly permits it', async () => {
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => {
      if (section === 'skills') {
        return {
          output: {
            success: true,
            rewritten_content: 'star schema, snowflake schema, modelagem dimensional',
            section_data: ['star schema', 'snowflake schema', 'modelagem dimensional'],
            keywords_added: ['modelagem dimensional'],
            changes_made: ['Skills normalizadas para a vaga'],
          },
        }
      }

      return {
        output: buildSuccessfulRewriteOutput({
          ...buildCvState(),
          skills: ['star schema', 'snowflake schema'],
        }, section),
      }
    })

    const result = await rewriteResumeFull({
      mode: 'job_targeting',
      cvState: {
        ...buildCvState(),
        skills: ['star schema', 'snowflake schema'],
      },
      targetJobDescription: 'Requisitos: modelagem dimensional',
      gapAnalysis: {
        matchScore: 68,
        missingSkills: [],
        weakAreas: [],
        improvementSuggestions: [],
      },
      targetingPlan: buildDefaultTargetingPlan({
        focusKeywords: ['modelagem dimensional'],
        mustEmphasize: ['modelagem dimensional'],
        missingButCannotInvent: [],
        targetEvidence: [{
          jobSignal: 'modelagem dimensional',
          canonicalSignal: 'modelagem dimensional',
          evidenceLevel: 'technical_equivalent',
          rewritePermission: 'can_claim_normalized',
          matchedResumeTerms: ['star schema', 'snowflake schema'],
          supportingResumeSpans: ['star schema', 'snowflake schema'],
          rationale: 'Esquemas star e snowflake sustentam o conceito.',
          confidence: 0.88,
          allowedRewriteForms: ['modelagem dimensional', 'star schema', 'snowflake schema'],
          forbiddenRewriteForms: [],
          validationSeverityIfViolated: 'none',
        }],
        rewritePermissions: {
          directClaimsAllowed: [],
          normalizedClaimsAllowed: ['modelagem dimensional'],
          bridgeClaimsAllowed: [],
          relatedButNotClaimable: [],
          forbiddenClaims: [],
          skillsSurfaceAllowed: ['modelagem dimensional'],
        },
      }),
      userId: 'usr_123',
      sessionId: 'sess_job_123',
    })

    expect(result.success).toBe(true)
    expect(result.optimizedCvState?.skills).toEqual(['modelagem dimensional', 'star schema', 'snowflake schema'])
  })

  it('does not apply the ATS-only summary noise gate to job_targeting summaries', async () => {
    const targetedSummary = [
      'Analytics Engineer com foco em SQL, Power BI e BigQuery.',
      'Experiencia em dashboards, automacao analitica e traducao para negocio.',
      'Atuacao com prioridades alinhadas a analytics engineering.',
    ].join(' ')

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: section === 'summary'
        ? {
            success: true,
            rewritten_content: targetedSummary,
            section_data: targetedSummary,
            keywords_added: ['SQL', 'BigQuery'],
            changes_made: ['Resumo targetizado'],
          }
        : buildSuccessfulRewriteOutput(buildCvState(), section),
    }))

    const result = await rewriteResumeFull({
      mode: 'job_targeting',
      cvState: buildCvState(),
      targetJobDescription: [
        'Cargo: Analytics Engineer',
        'Responsabilidades: construir modelos, dashboards e analises em BigQuery.',
        'Requisitos: SQL, BigQuery, comunicacao com negocio.',
      ].join('\n'),
      gapAnalysis: {
        matchScore: 68,
        missingSkills: ['BigQuery'],
        weakAreas: ['summary'],
        improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiência.'],
      },
      targetingPlan: {
        targetRole: 'Analytics Engineer',
        targetRoleConfidence: 'high',
        targetRoleSource: 'heuristic',
        focusKeywords: ['sql', 'bigquery'],
        mustEmphasize: ['SQL', 'BigQuery'],
        shouldDeemphasize: ['ETL'],
        missingButCannotInvent: ['BigQuery'],
        sectionStrategy: {
          summary: ['Aproxime o posicionamento do cargo alvo sem afirmar dominio inexistente.'],
          experience: ['Priorize contexto analitico e stack relevante.'],
          skills: ['Reordene por aderencia a vaga.'],
          education: ['Mantenha factual.'],
          certifications: ['Destaque somente o que ajuda na vaga.'],
        },
      },
      userId: 'usr_123',
      sessionId: 'sess_job_123',
    })

    expect(result.success).toBe(true)
    expect(result.optimizedCvState?.summary).toBe(targetedSummary)
    expect(result.diagnostics?.sectionAttempts.summary).toBe(1)
    expect(result.diagnostics?.retriedSections).not.toContain('summary')
  })

  it('persists a completed job_targeting rewrite and logs target-role workflow completion', async () => {
    const session = buildSession()
    const jobCompatibilityAssessment = buildPipelineAssessment()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'Cargo: Analytics Engineer',
      'Responsabilidades: construir dashboards e automacoes de dados.',
      'Requisitos: SQL, Power BI, BigQuery.',
    ].join('\n')
    session.agentState.rewriteStatus = 'pending'
    session.agentState.optimizedCvState = undefined

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Analytics engineer com foco em SQL, Power BI e automacao orientada a negocio.',
      }, section),
    }))
    mockGenerateCvHighlightState.mockImplementation(async (_cvState, context) => {
      context?.onCompleted?.(buildHighlightDetectionOutcome({
        resultKind: 'valid_non_empty',
        rawModelItemCount: 1,
        rawModelRangeCount: 1,
        validatedItemCount: 1,
        validatedRangeCount: 1,
      }))
      return buildHighlightStateFixture({
        workflowMode: 'job_targeting',
        generatedAt: '2026-04-23T12:00:00.000Z',
        resolvedHighlights: [{
          itemId: 'summary_0',
          section: 'summary',
          ranges: [{ start: 0, end: 29, reason: 'ats_strength' }],
        }],
      })
    })
    mockEvaluateJobCompatibility.mockResolvedValue(jobCompatibilityAssessment)

    const result = await runJobTargetingPipeline(session)
    expect(result.success).toBe(true)
    expect(mockAnalyzeGap.mock.invocationCallOrder[0]).toBeLessThan(
      mockEvaluateJobCompatibility.mock.invocationCallOrder[0]!,
    )
    expect(mockEvaluateJobCompatibility).toHaveBeenCalledWith({
      cvState: session.cvState,
      targetJobDescription: session.agentState.targetJobDescription,
      gapAnalysis: expect.objectContaining({
        matchScore: 68,
        missingSkills: ['BigQuery'],
        weakAreas: ['summary'],
        improvementSuggestions: [expect.stringContaining('Aproxime o resumo da vaga')],
      }),
      userId: session.userId,
      sessionId: session.id,
    })
    expect(mockBuildTargetedRewritePlan).toHaveBeenCalledWith(expect.objectContaining({
      jobCompatibilityAssessment,
    }))
    expect(session.agentState.workflowMode).toBe('job_targeting')
    expect(session.agentState.jobCompatibilityAssessment).toBe(jobCompatibilityAssessment)
    expect(session.agentState.targetingPlan).toMatchObject({
      targetRole: expect.any(String),
      targetRoleConfidence: expect.any(String),
    })
    expect(session.agentState.lastRewriteMode).toBe('job_targeting')
    expect(session.agentState.highlightState?.highlightSource).toBe('job_targeting')
    expect(session.agentState.jobTargetingExplanation).toMatchObject({
      source: 'job_targeting',
      version: 1,
      targetRole: 'Analytics Engineer',
      scoreBreakdown: expect.objectContaining({
        total: 52,
        maxTotal: 100,
        items: expect.arrayContaining([
          expect.objectContaining({ id: 'skills', max: 100 }),
          expect.objectContaining({ id: 'experience', max: 100 }),
          expect.objectContaining({ id: 'education', max: 100 }),
        ]),
      }),
      targetRecommendations: expect.arrayContaining([
        expect.objectContaining({
          jobRequirement: 'BigQuery',
          mustNotInvent: true,
        }),
      ]),
    })
    expect(mockValidateRewrite).toHaveBeenCalledWith(
      session.cvState,
      expect.any(Object),
      expect.objectContaining({
        mode: 'job_targeting',
        jobCompatibilityAssessment,
      }),
    )
    expect(result.jobTargetingExplanation).toBe(session.agentState.jobTargetingExplanation)
    const persistedAgentStates = mockUpdateSession.mock.calls
      .map(([, patch]) => (patch as { agentState?: Session['agentState'] }).agentState)
      .filter((agentState): agentState is Session['agentState'] => Boolean(agentState))
    expect(
      persistedAgentStates
        .filter((agentState) => agentState.gapAnalysis || agentState.targetingPlan)
        .every((agentState) => agentState.jobCompatibilityAssessment === jobCompatibilityAssessment),
    ).toBe(true)
    expect(mockGenerateCvHighlightState).toHaveBeenCalledTimes(1)
    expect(mockGenerateCvHighlightState).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        workflowMode: 'job_targeting',
        jobKeywords: ['BigQuery'],
      }),
    )
    expect(session.agentState.highlightState).toEqual(buildHighlightStateFixture({
      workflowMode: 'job_targeting',
      generatedAt: '2026-04-23T12:00:00.000Z',
      resolvedHighlights: [{
        itemId: 'summary_0',
        section: 'summary',
        ranges: [{ start: 0, end: 29, reason: 'ats_strength' }],
      }],
    }))
    expect(mockCreateCvVersion).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: session.id,
      source: 'job-targeting',
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.persisted', expect.objectContaining({
      workflowMode: 'job_targeting',
      highlightStatePersistedReason: 'generated',
      highlightStateResultKind: 'valid_non_empty',
      highlightStateResolvedItemCount: 1,
      highlightStateResolvedRangeCount: 1,
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.generation_gate', expect.objectContaining({
      workflowMode: 'job_targeting',
      highlightGenerationDecision: 'allowed',
      jobKeywordsCount: 1,
      validationBlocked: false,
      optimizedChanged: true,
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.job_targeting.completed', expect.objectContaining({
      workflowMode: 'job_targeting',
      success: true,
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('job_targeting.compatibility.started', expect.objectContaining({
      sessionId: session.id,
      userId: session.userId,
      cvStatePresent: true,
      targetJobDescriptionPresent: true,
      gapAnalysisPresent: true,
    }))
    for (const eventName of [
      'job_targeting.compatibility.catalog_loaded',
      'job_targeting.compatibility.requirements_extracted',
      'job_targeting.compatibility.evidence_classified',
      'job_targeting.compatibility.claim_policy_built',
      'job_targeting.compatibility.score_calculated',
      'job_targeting.compatibility.completed',
    ]) {
      expect(mockLogInfo).toHaveBeenCalledWith(eventName, expect.objectContaining({
        sessionId: session.id,
        userId: session.userId,
        assessmentVersion: 'job-compat-assessment-v1',
        catalogVersions: {
          'generic-taxonomy': '1.0.0',
          'data-bi': '1.2.0',
        },
        scoreVersion: 'job-compat-score-v1',
        totalRequirements: 4,
        supportedCount: 1,
        adjacentCount: 1,
        unsupportedCount: 2,
        criticalGapCount: 1,
        allowedClaimCount: 1,
        cautiousClaimCount: 1,
        forbiddenClaimCount: 1,
        deterministicCount: 1,
        catalogCount: 1,
        llmCount: 1,
        fallbackCount: 1,
        lowFitTriggered: true,
        lowFitBlocking: false,
      }))
    }
    const serializedCompatibilityLogs = JSON.stringify(
      mockLogInfo.mock.calls.filter(([eventName]) => (
        typeof eventName === 'string' && eventName.startsWith('job_targeting.compatibility.')
      )),
    )
    expect(serializedCompatibilityLogs).not.toContain(session.agentState.targetJobDescription)
    expect(serializedCompatibilityLogs).not.toContain(session.cvState.email)
    expect(serializedCompatibilityLogs).not.toContain(session.cvState.summary)
    expect(mockLogInfo).toHaveBeenCalledWith('agent.job_targeting.pipeline_trace', expect.objectContaining({
      sessionId: session.id,
      userId: session.userId,
      status: 'success',
      extraction: expect.objectContaining({
        targetRole: 'Analytics Engineer',
        targetRoleConfidence: 'high',
        targetRoleSource: 'heuristic',
        jobKeywordsCount: 1,
        targetEvidenceCount: 2,
        evidenceLevelCounts: expect.objectContaining({
          explicit: 1,
          unsupported_gap: 1,
        }),
      }),
      gapAnalysis: expect.objectContaining({
        matchScore: 68,
        missingSkillsCount: 1,
        weakAreasCount: 1,
        repairAttempted: false,
      }),
      rewrite: expect.objectContaining({
        sectionsChanged: ['summary', 'experience', 'skills', 'education', 'certifications'],
      }),
      validation: expect.objectContaining({
        blocked: false,
        hardIssuesCount: 0,
        softWarningsCount: 0,
      }),
      highlight: expect.objectContaining({
        gate: 'allowed',
        generated: true,
        highlightSource: 'job_targeting',
        jobKeywordsCount: 1,
      }),
    }))
  })

  it('runs JobCompatibilityAssessment in shadow mode without changing rewrite source of truth', async () => {
    vi.stubEnv('JOB_COMPATIBILITY_ASSESSMENT_ENABLED', 'true')
    vi.stubEnv('JOB_COMPATIBILITY_ASSESSMENT_SHADOW_MODE', 'true')
    vi.stubEnv('JOB_COMPATIBILITY_ASSESSMENT_SOURCE_OF_TRUTH', 'false')

    const session = buildSession()
    const jobCompatibilityAssessment = buildPipelineAssessment()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'Cargo: Analytics Engineer',
      'Responsabilidades: construir dashboards e automacoes de dados.',
      'Requisitos: SQL, Power BI, BigQuery.',
    ].join('\n')
    session.agentState.rewriteStatus = 'pending'
    mockEvaluateJobCompatibility.mockResolvedValue(jobCompatibilityAssessment)
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Analista de dados com foco em SQL, Power BI e automacao orientada a negocio.',
      }, section),
    }))

    const result = await runJobTargetingPipeline(session)
    const buildPlanInput = mockBuildTargetedRewritePlan.mock.calls[0]?.[0] as {
      jobCompatibilityAssessment?: JobCompatibilityAssessment
    }

    expect(result.success).toBe(true)
    expect(buildPlanInput.jobCompatibilityAssessment).toBeUndefined()
    expect(session.agentState.jobCompatibilityAssessment).toBeUndefined()
    expect(session.agentState.jobCompatibilityAssessmentShadow).toBe(jobCompatibilityAssessment)
    expect(mockValidateRewrite).toHaveBeenCalledWith(
      session.cvState,
      expect.any(Object),
      expect.not.objectContaining({
        jobCompatibilityAssessment,
      }),
    )
    expect(mockLogInfo).toHaveBeenCalledWith('job_targeting.compatibility.shadow_comparison', expect.objectContaining({
      sessionId: session.id,
      userId: session.userId,
      legacyScore: 68,
      assessmentScore: jobCompatibilityAssessment.scoreBreakdown.total,
      scoreDelta: expect.any(Number),
      assessmentSupportedCount: jobCompatibilityAssessment.supportedRequirements.length,
      assessmentAdjacentCount: jobCompatibilityAssessment.adjacentRequirements.length,
      assessmentUnsupportedCount: jobCompatibilityAssessment.unsupportedRequirements.length,
      assessmentForbiddenClaimCount: jobCompatibilityAssessment.claimPolicy.forbiddenClaims.length,
    }))
    expect(mockCreateJobCompatibilityShadowComparison).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: session.id,
      userId: session.userId,
      source: 'pipeline_shadow',
      legacy: expect.objectContaining({
        score: 68,
        lowFitTriggered: false,
      }),
      assessment: jobCompatibilityAssessment,
    }))
  })

  it('replaces a previous ATS highlight artifact with a job_targeting highlight on successful targeting', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'Cargo: Analytics Engineer',
      'Responsabilidades: construir dashboards e automacoes de dados.',
      'Requisitos: SQL, Power BI, BigQuery.',
    ].join('\n')
    session.agentState.highlightState = buildHighlightStateFixture({
      workflowMode: 'ats_enhancement',
      generatedAt: '2026-04-20T12:00:00.000Z',
    })

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Analytics engineer com foco em SQL, Power BI e automacao orientada a negocio.',
      }, section),
    }))

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(true)
    expect(session.agentState.highlightState?.highlightSource).toBe('job_targeting')
    expect(session.agentState.highlightState?.highlightGeneratedAt).toBe('2026-04-22T12:00:00.000Z')
  })

  it('preserves trace semantics: zero evidence means executed, not skipped', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'Cargo: Analytics Engineer',
      'Responsabilidades: construir dashboards e automacoes de dados.',
      'Requisitos: SQL e Power BI.',
    ].join('\n')

    mockBuildTargetedRewritePlan.mockReturnValue(buildDefaultTargetingPlan({
      targetEvidence: [],
      rewritePermissions: {
        directClaimsAllowed: [],
        normalizedClaimsAllowed: [],
        bridgeClaimsAllowed: [],
        relatedButNotClaimable: [],
        forbiddenClaims: [],
        skillsSurfaceAllowed: [],
      },
    }))
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput(buildCvState(), section),
    }))

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(true)
    expect(mockLogInfo).toHaveBeenCalledWith('agent.job_targeting.pipeline_trace', expect.objectContaining({
      extraction: expect.objectContaining({
        targetEvidenceCount: 0,
        evidenceLevelCounts: {},
      }),
    }))
  })

  it('passes gap-derived job keywords into job_targeting highlight generation with a max of 20 unique terms', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'Cargo: Analytics Engineer',
      'Responsabilidades: construir dashboards e automacoes de dados.',
      'Requisitos: SQL, Power BI, dbt e Tableau.',
    ].join('\n')

    mockAnalyzeGap.mockResolvedValue({
      output: {
        success: true,
        result: {
          matchScore: 68,
          missingSkills: [
            'Tableau',
            'dbt',
            'Airflow',
            'Snowflake',
            'Looker',
            'Kafka',
            'Docker',
            'Kubernetes',
            'Terraform',
            'AWS',
            'GCP',
            'Azure',
            'Spark',
            'Databricks',
            'Python',
            'SQL',
            'Power BI',
            'Excel',
            'Git',
            'CI/CD',
            'Tableau',
            'Fivetran',
          ],
          weakAreas: ['summary'],
          improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiência.'],
        },
      },
      result: {
        matchScore: 68,
        missingSkills: [
          'Tableau',
          'dbt',
          'Airflow',
          'Snowflake',
          'Looker',
          'Kafka',
          'Docker',
          'Kubernetes',
          'Terraform',
          'AWS',
          'GCP',
          'Azure',
          'Spark',
          'Databricks',
          'Python',
          'SQL',
          'Power BI',
          'Excel',
          'Git',
          'CI/CD',
          'Tableau',
          'Fivetran',
        ],
        weakAreas: ['summary'],
        improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiência.'],
      },
    })
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Analytics engineer com foco em SQL, Power BI, Tableau e dbt para automacao analitica.',
      }, section),
    }))

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(true)
    expect(mockGenerateCvHighlightState).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        workflowMode: 'job_targeting',
        jobKeywords: [
          'Tableau',
          'dbt',
          'Airflow',
          'Snowflake',
          'Looker',
          'Kafka',
          'Docker',
          'Kubernetes',
          'Terraform',
          'AWS',
          'GCP',
          'Azure',
          'Spark',
          'Databricks',
          'Python',
          'SQL',
          'Power BI',
          'Excel',
          'Git',
          'CI/CD',
        ],
      }),
    )
  })

  it('falls back to targetingPlan.mustEmphasize when gapAnalysis.missingSkills is empty', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'Cargo: Analytics Engineer',
      'Responsabilidades: construir dashboards e automacoes de dados.',
      'Requisitos: SQL, Power BI e comunicacao com negocio.',
    ].join('\n')

    mockAnalyzeGap.mockResolvedValue({
      output: {
        success: true,
        result: {
          matchScore: 74,
          missingSkills: [],
          weakAreas: ['summary'],
          improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiência.'],
        },
      },
      result: {
        matchScore: 74,
        missingSkills: [],
        weakAreas: ['summary'],
        improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiência.'],
      },
    })
    mockBuildTargetedRewritePlan.mockReturnValue(buildDefaultTargetingPlan({
      mustEmphasize: ['SQL', 'Power BI'],
      focusKeywords: ['sql', 'power bi'],
    }))
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Analytics engineer com foco em SQL, Power BI e automacao analitica para negocio.',
      }, section),
    }))

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(true)
    expect(mockBuildTargetedRewritePlan).toHaveBeenCalledTimes(1)
    expect(mockBuildTargetingPlan).not.toHaveBeenCalled()
    expect(mockGenerateCvHighlightState).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        workflowMode: 'job_targeting',
        jobKeywords: ['SQL', 'Power BI'],
      }),
    )
  })

  it('excludes low-confidence placeholder target roles from highlight keywords', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'About The Job',
      'Buscamos profissionais com forte experiência em Power BI e análise de dados.',
      'Requisitos: SQL, BI e dashboards executivos.',
    ].join('\n')

    mockAnalyzeGap.mockResolvedValue({
      output: {
        success: true,
        result: {
          matchScore: 60,
          missingSkills: [],
          weakAreas: ['summary'],
          improvementSuggestions: [],
        },
      },
      result: {
        matchScore: 60,
        missingSkills: [],
        weakAreas: ['summary'],
        improvementSuggestions: [],
      },
    })
    mockBuildTargetedRewritePlan.mockReturnValue(buildDefaultTargetingPlan({
      targetRole: 'Vaga Alvo',
      targetRoleConfidence: 'low',
      mustEmphasize: ['Vaga Alvo', 'SQL', 'sql', 'BI'],
      focusKeywords: ['Vaga Alvo', 'Power BI'],
    }))
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Profissional com foco em SQL, Power BI e dashboards executivos.',
      }, section),
    }))

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(true)
    expect(mockGenerateCvHighlightState).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        workflowMode: 'job_targeting',
        jobKeywords: ['SQL'],
      }),
    )
  })

  it('falls back to targetingPlan.focusKeywords when mustEmphasize is empty', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'Cargo: Analytics Engineer',
      'Responsabilidades: construir dashboards e automacoes de dados.',
      'Requisitos: SQL, Power BI e comunicacao com negocio.',
    ].join('\n')

    mockAnalyzeGap.mockResolvedValue({
      output: {
        success: true,
        result: {
          matchScore: 82,
          missingSkills: [],
          weakAreas: ['summary'],
          improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiência.'],
        },
      },
      result: {
        matchScore: 82,
        missingSkills: [],
        weakAreas: ['summary'],
        improvementSuggestions: ['Aproxime o resumo da vaga sem inventar experiência.'],
      },
    })
    mockBuildTargetedRewritePlan.mockReturnValue(buildDefaultTargetingPlan({
      mustEmphasize: [],
      focusKeywords: ['sql', 'power bi'],
    }))
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Analytics engineer com foco em SQL, Power BI e automacao analitica para negocio.',
      }, section),
    }))

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(true)
    expect(mockGenerateCvHighlightState).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        workflowMode: 'job_targeting',
        jobKeywords: ['sql', 'power bi'],
      }),
    )
  })

  it('falls back to targetFitAssessment reasons when gap and targetingPlan keywords are empty', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = 'Role with analytics and stakeholder communication.'

    mockAnalyzeGap.mockResolvedValue({
      output: {
        success: true,
        result: {
          matchScore: 60,
          missingSkills: [],
          weakAreas: [],
          improvementSuggestions: [],
        },
      },
      result: {
        matchScore: 60,
        missingSkills: [],
        weakAreas: [],
        improvementSuggestions: [],
      },
    })
    mockBuildTargetedRewritePlan.mockReturnValue(buildDefaultTargetingPlan({
      mustEmphasize: [],
      focusKeywords: [],
    }))
    mockDeriveTargetFitAssessment.mockReturnValue({
      level: 'medium',
      scoreLabel: 'Moderately aligned',
      confidence: 'high',
      reasons: ['Lacunas relevantes: SQL', 'Sem cobertura: Power BI'],
      generatedAt: '2026-04-22T12:00:00.000Z',
    })
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Analytics profile with SQL, stakeholder communication and business translation.',
      }, section),
    }))

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(true)
    expect(mockGenerateCvHighlightState).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        workflowMode: 'job_targeting',
        jobKeywords: ['SQL', 'Power BI'],
      }),
    )
  })

  it('falls back to targetJobDescription terms when gap, targeting plan and fit reasons are empty', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = 'Role with analytics and stakeholder communication.'

    mockAnalyzeGap.mockResolvedValue({
      output: {
        success: true,
        result: {
          matchScore: 60,
          missingSkills: [],
          weakAreas: [],
          improvementSuggestions: [],
        },
      },
      result: {
        matchScore: 60,
        missingSkills: [],
        weakAreas: [],
        improvementSuggestions: [],
      },
    })
    mockBuildTargetedRewritePlan.mockReturnValue(buildDefaultTargetingPlan({
      mustEmphasize: [],
      focusKeywords: [],
    }))
    mockDeriveTargetFitAssessment.mockReturnValue({
      level: 'medium',
      scoreLabel: 'Moderately aligned',
      confidence: 'high',
      reasons: [],
      generatedAt: '2026-04-22T12:00:00.000Z',
    })
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Analytics profile with SQL, stakeholder communication and business translation.',
      }, section),
    }))

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(true)
    expect(mockGenerateCvHighlightState).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        workflowMode: 'job_targeting',
        jobKeywords: ['Role', 'analytics', 'stakeholder communication.'],
      }),
    )
  })

  describe('job_targeting highlight seam isolation', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      resetOpenAICircuitBreakerForTest()
    })

    it('job_targeting: editorial correction propagates through real resolver', async () => {
      const session = buildSession()
      session.agentState.workflowMode = 'job_targeting'
      session.agentState.targetJobDescription = [
        'Cargo: Analytics Engineer',
        'Responsabilidades: otimizar pipelines e dashboards.',
        'Requisitos: SQL, Power BI, Databricks.',
      ].join('\n')
      session.agentState.rewriteStatus = 'pending'
      session.agentState.optimizedCvState = undefined

      const bulletText = 'Otimizei fluxos internos reduzindo em 40%'
      const rewrittenExperience = {
        title: 'Senior BI Engineer',
        company: 'ACME',
        startDate: '2022',
        endDate: 'present',
        bullets: [bulletText],
      }
      const expectedItemId = createExperienceBulletHighlightItemId(
        rewrittenExperience,
        rewrittenExperience.bullets[0],
      )

      mockUpdateSession.mockResolvedValue(undefined)
      mockCreateCvVersion.mockResolvedValue({
        id: 'ver_job_highlight_123',
        sessionId: session.id,
        snapshot: buildCvState(),
        source: 'job-targeting',
        createdAt: new Date('2026-04-22T12:00:00.000Z'),
      })
      mockValidateRewrite.mockReturnValue(buildRewriteValidationResult())
      const editorialAssessment = buildPipelineAssessment()
      editorialAssessment.claimPolicy = {
        ...editorialAssessment.claimPolicy,
        allowedClaims: [
          ...editorialAssessment.claimPolicy.allowedClaims,
          {
            id: 'claim-editorial-title',
            signal: 'Senior BI Engineer',
            permission: 'allowed',
            evidenceBasis: [{ id: 'span-editorial-title', text: 'BI Engineer' }],
            allowedTerms: ['Senior BI Engineer', 'BI Engineer'],
            prohibitedTerms: [],
            rationale: 'Fixture permits the rewritten title for highlight resolver isolation.',
            requirementIds: ['req-supported-exact'],
          },
          {
            id: 'claim-editorial-impact',
            signal: 'reduzindo',
            permission: 'allowed',
            evidenceBasis: [{ id: 'span-editorial-impact', text: 'reduzindo em 40%' }],
            allowedTerms: ['reduzindo', '40%'],
            prohibitedTerms: [],
            rationale: 'Fixture permits the rewritten impact bullet for highlight resolver isolation.',
            requirementIds: ['req-supported-exact'],
          },
        ],
      }
      mockEvaluateJobCompatibility.mockResolvedValue(editorialAssessment)
      mockAnalyzeGap.mockResolvedValue({
        output: {
          success: true,
          result: {
            matchScore: 68,
            missingSkills: ['Databricks'],
            weakAreas: ['experience'],
            improvementSuggestions: ['Aproxime os bullets de impacto.'],
          },
        },
        result: {
          matchScore: 68,
          missingSkills: ['Databricks'],
          weakAreas: ['experience'],
          improvementSuggestions: ['Aproxime os bullets de impacto.'],
        },
      })

      mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => {
        if (section === 'summary') {
          return {
            output: {
              success: true,
              rewritten_content: 'Analytics engineer com foco em SQL, Power BI e eficiencia operacional.',
              section_data: 'Analytics engineer com foco em SQL, Power BI e eficiencia operacional.',
              keywords_added: ['SQL', 'Power BI'],
              changes_made: ['Resumo targetizado'],
              claim_trace_items: [{
                targetPath: 'summary',
                source: 'new_generated_text',
                usedClaimPolicyIds: ['claim-supported-sql'],
                expressedSignals: ['SQL'],
                evidenceBasis: ['SQL'],
                permissionLevel: 'allowed',
              }],
            },
          }
        }

        if (section === 'experience') {
          return {
            output: {
              success: true,
              rewritten_content: 'Experiencia reestruturada.',
              section_data: [rewrittenExperience],
              keywords_added: ['Databricks'],
              changes_made: ['Bullets alinhados a impacto'],
              claim_trace_items: [
                {
                  targetPath: 'experience.0.title',
                  source: 'new_generated_text',
                  usedClaimPolicyIds: ['claim-editorial-title'],
                  expressedSignals: ['Senior BI Engineer'],
                  evidenceBasis: ['BI Engineer'],
                  permissionLevel: 'allowed',
                },
                {
                  targetPath: 'experience.0.bullets.0',
                  source: 'new_generated_text',
                  usedClaimPolicyIds: ['claim-editorial-impact'],
                  expressedSignals: ['reduzindo'],
                  evidenceBasis: ['reduzindo em 40%'],
                  permissionLevel: 'allowed',
                },
              ],
            },
          }
        }

        return {
          output: buildSuccessfulRewriteOutput(buildCvState(), section),
        }
      })

      createCompletion.mockImplementationOnce(async () => buildOpenAIResponse(JSON.stringify({
        items: [
          {
            itemId: expectedItemId,
            ranges: [{
              fragment: bulletText,
              start: 0,
              end: bulletText.indexOf('40%') + 3,
              reason: 'metric_impact',
            }],
          },
        ],
      })))

      mockGenerateCvHighlightState.mockImplementationOnce(async (cvState, context) => {
        const actual = await vi.importActual<typeof import('@/lib/agent/tools/detect-cv-highlights')>('@/lib/agent/tools/detect-cv-highlights')
        if (typeof actual.generateCvHighlightState !== 'function') {
          throw new Error(
            '[pipeline.test] vi.importActual did not return generateCvHighlightState as a function. '
            + 'The module path or export name may have changed. Update the import path in this mock.',
          )
        }
        return actual.generateCvHighlightState(cvState, context)
      })

      const result = await runJobTargetingPipeline(session)

      expect(result.success).toBe(true)
      expect(createCompletion).toHaveBeenCalledTimes(1)

      const resolvedRanges = session.agentState.highlightState?.resolvedHighlights
        .find((highlight) => highlight.itemId === expectedItemId)?.ranges ?? []

      expect(resolvedRanges.length).toBeGreaterThan(0)

      const correctedRange = resolvedRanges[0]!
      expect(bulletText.slice(correctedRange.start, correctedRange.end)).toContain('reduzindo')
      expect(correctedRange.start).toBeGreaterThan(0)

      expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.persisted', expect.objectContaining({
        workflowMode: 'job_targeting',
        highlightStatePersistedReason: 'generated',
        highlightStateResultKind: 'valid_non_empty',
        highlightStateResolvedItemCount: 1,
        highlightStateResolvedRangeCount: 1,
      }))
    })
  })

  it('skips highlight generation for unchanged job_targeting rewrites and logs the unchanged-state reason', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'Cargo: Analytics Engineer',
      'Responsabilidades: construir dashboards e automacoes de dados.',
      'Requisitos: SQL, Power BI, BigQuery.',
    ].join('\n')
    session.agentState.rewriteStatus = 'pending'
    session.agentState.optimizedCvState = undefined

    const originalCvState = buildCvState()
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => {
      if (section === 'summary') {
        return {
          output: {
            success: true,
            rewritten_content: originalCvState.summary,
            section_data: originalCvState.summary,
            keywords_added: [],
            changes_made: [],
          },
        }
      }

      if (section === 'experience') {
        return {
          output: {
            success: true,
            rewritten_content: 'Experiencia original mantida.',
            section_data: originalCvState.experience,
            keywords_added: [],
            changes_made: [],
          },
        }
      }

      if (section === 'skills') {
        return {
          output: {
            success: true,
            rewritten_content: originalCvState.skills.join(', '),
            section_data: originalCvState.skills,
            keywords_added: [],
            changes_made: [],
          },
        }
      }

      if (section === 'education') {
        return {
          output: {
            success: true,
            rewritten_content: 'Educacao original mantida.',
            section_data: originalCvState.education,
            keywords_added: [],
            changes_made: [],
          },
        }
      }

      return {
        output: {
          success: true,
          rewritten_content: 'Certificacoes originais mantidas.',
          section_data: originalCvState.certifications ?? [],
          keywords_added: [],
          changes_made: [],
        },
      }
    })

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(true)
    expect(session.agentState.highlightState).toBeUndefined()
    expect(mockGenerateCvHighlightState).not.toHaveBeenCalled()
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.persisted', expect.objectContaining({
      workflowMode: 'job_targeting',
      highlightDetectionInvoked: false,
      highlightStateGenerated: false,
      highlightStatePersisted: false,
      highlightStatePersistedReason: 'not_generated_for_unchanged_cv_state',
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.generation_gate', expect.objectContaining({
      workflowMode: 'job_targeting',
      highlightGenerationDecision: 'blocked_unchanged_cv_state',
      validationBlocked: false,
      optimizedChanged: false,
    }))
  })

  it('preserves the previous job_targeting highlight when a rerun produces the same optimized cvState', async () => {
    const session = buildSession()
    const previousOptimizedCvState = {
      ...buildCvState(),
      summary: 'Analytics engineer com foco em SQL, Power BI e automacao orientada a negocio.',
    }
    const previousHighlightState = buildHighlightStateFixture({
      workflowMode: 'job_targeting',
      generatedAt: '2026-04-21T12:00:00.000Z',
      resolvedHighlights: [{
        itemId: 'summary_0',
        section: 'summary',
        ranges: [{ start: 0, end: 18, reason: 'ats_strength' }],
      }],
    })

    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'Cargo: Analytics Engineer',
      'Responsabilidades: construir dashboards e automacoes de dados.',
      'Requisitos: SQL, Power BI, BigQuery.',
    ].join('\n')
    session.agentState.rewriteStatus = 'pending'
    session.agentState.optimizedCvState = previousOptimizedCvState
    session.agentState.highlightState = previousHighlightState

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => {
      if (section === 'summary') {
        return {
          output: {
            success: true,
            rewritten_content: previousOptimizedCvState.summary,
            section_data: previousOptimizedCvState.summary,
            keywords_added: ['SQL', 'Power BI'],
            changes_made: ['Resumo targetizado mantido'],
          },
        }
      }

      if (section === 'experience') {
        return {
          output: {
            success: true,
            rewritten_content: 'Experiencia mantida.',
            section_data: previousOptimizedCvState.experience,
            keywords_added: [],
            changes_made: [],
          },
        }
      }

      if (section === 'skills') {
        return {
          output: {
            success: true,
            rewritten_content: previousOptimizedCvState.skills.join(', '),
            section_data: previousOptimizedCvState.skills,
            keywords_added: [],
            changes_made: [],
          },
        }
      }

      if (section === 'education') {
        return {
          output: {
            success: true,
            rewritten_content: 'Educacao mantida.',
            section_data: previousOptimizedCvState.education,
            keywords_added: [],
            changes_made: [],
          },
        }
      }

      return {
        output: {
          success: true,
          rewritten_content: 'Certificacoes mantidas.',
          section_data: previousOptimizedCvState.certifications ?? [],
          keywords_added: [],
          changes_made: [],
        },
      }
    })

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(true)
    expect(session.agentState.optimizedCvState).toEqual(previousOptimizedCvState)
    expect(session.agentState.highlightState).toEqual(previousHighlightState)
    expect(mockGenerateCvHighlightState).not.toHaveBeenCalled()
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.generation_gate', expect.objectContaining({
      workflowMode: 'job_targeting',
      highlightGenerationDecision: 'blocked_unchanged_cv_state',
      validationBlocked: false,
      optimizedChanged: false,
    }))
  })

  it('logs the exact validation issues when job_targeting validation fails', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'Cargo: BI.',
      'Responsabilidades: construir dashboards e automacoes de dados.',
      'Estamos contratando Analista de BI para atuar com SQL, Power BI e indicadores.',
    ].join('\n')
    session.agentState.rewriteStatus = 'pending'

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Analista de BI com foco em SQL, Power BI e alinhamento completo com a vaga.',
      }, section),
    }))

    mockValidateRewrite.mockReturnValue(buildRewriteValidationResult({
      blocked: true,
      valid: false,
      hardIssues: [{
        severity: 'high',
        message: 'O resumo targetizado passou a se apresentar diretamente como o cargo alvo sem evidência equivalente no currículo original.',
        section: 'summary',
      }],
      issues: [{
        severity: 'high',
        message: 'O resumo targetizado passou a se apresentar diretamente como o cargo alvo sem evidência equivalente no currículo original.',
        section: 'summary',
      }],
    }))

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(false)
    expect(session.agentState.rewriteStatus).toBe('failed')
    expect(session.agentState.atsWorkflowRun).toMatchObject({
      status: 'failed',
      currentStage: 'validation',
      lastFailureStage: 'validation',
      lastFailureReason: expect.stringContaining('O resumo targetizado passou a se apresentar diretamente como o cargo alvo'),
    })
    expect(mockLogWarn).toHaveBeenCalledWith('agent.job_targeting.validation_failed', expect.objectContaining({
      workflowMode: 'job_targeting',
      issueCount: 1,
      issueSections: 'summary',
      issueMessages: expect.stringContaining('O resumo targetizado passou a se apresentar diretamente como o cargo alvo'),
      targetRole: 'Analytics Engineer',
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.generation_gate', expect.objectContaining({
      workflowMode: 'job_targeting',
      highlightGenerationDecision: 'blocked_validation_failed',
      validationBlocked: true,
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.job_targeting.pipeline_trace', expect.objectContaining({
      sessionId: session.id,
      userId: session.userId,
      status: 'blocked',
      error: 'Job targeting rewrite validation failed.',
      validation: expect.objectContaining({
        blocked: true,
        hardIssuesCount: 1,
        softWarningsCount: 0,
        hardIssues: [{
          section: 'summary',
          message: expect.stringContaining('O resumo targetizado passou a se apresentar diretamente como o cargo alvo'),
        }],
      }),
      highlight: expect.objectContaining({
        gate: 'blocked_validation_failed',
        generated: false,
      }),
    }))
  })

  it('blocks extreme low-fit vacancies before rewrite starts and skips rewrite, validation, highlight, and persistence', async () => {
    const session = buildSession()
    const jobCompatibilityAssessment = buildPipelineAssessment()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'Cargo: Desenvolvedor Java',
      'Requisitos: 5+ anos em Java, Spring Boot, JPA/Hibernate, Kafka/RabbitMQ, microsserviços, Docker e CI/CD.',
    ].join('\n')
    session.agentState.rewriteStatus = 'pending'
    mockEvaluateJobCompatibility.mockResolvedValue(jobCompatibilityAssessment)

    mockBuildTargetedRewritePlan.mockReturnValue(buildDefaultTargetingPlan({
      targetRole: 'Desenvolvedor Java',
      targetRolePositioning: {
        targetRole: 'Desenvolvedor Java',
        permission: 'must_not_claim_target_role',
        reason: 'career_fit_high_risk',
        safeRolePositioning: 'Profissional com experiência em BI, SQL, APIs REST e Git.',
        forbiddenRoleClaims: ['Desenvolvedor Java'],
      },
      rewritePermissions: {
        directClaimsAllowed: ['Git', 'APIs REST', 'SQL'],
        normalizedClaimsAllowed: [],
        bridgeClaimsAllowed: [],
        relatedButNotClaimable: [],
        forbiddenClaims: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'Docker', 'CI/CD'],
        skillsSurfaceAllowed: ['Git', 'APIs REST', 'SQL'],
      },
      coreRequirementCoverage: {
        requirements: [],
        total: 7,
        supported: 0,
        unsupported: 7,
        unsupportedSignals: ['Java', '5+ anos de Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'Docker', 'CI/CD'],
        topUnsupportedSignalsForDisplay: ['Java', '5+ anos de Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'Docker'],
      },
      lowFitWarningGate: {
        triggered: true,
        reason: 'very_low_match_score',
        matchScore: 28,
        riskLevel: 'high',
        familyDistance: 'distant',
        explicitEvidenceCount: 1,
        unsupportedGapCount: 12,
        unsupportedGapRatio: 0.923,
        explicitEvidenceRatio: 0.077,
        coreRequirementCoverage: {
          total: 7,
          supported: 0,
          unsupported: 7,
          unsupportedSignals: ['Java', '5+ anos de Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'Docker', 'CI/CD'],
          topUnsupportedSignalsForDisplay: ['Java', '5+ anos de Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'Docker'],
        },
      },
    }))

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(false)
    expect(session.agentState.jobCompatibilityAssessment).toBe(jobCompatibilityAssessment)
    expect(result.validation).toEqual(expect.objectContaining({
      blocked: true,
      recoverable: true,
      hardIssues: expect.arrayContaining([
        expect.objectContaining({
          issueType: 'low_fit_target_role',
        }),
      ]),
    }))
    expect(result.recoverableBlock).toEqual(expect.objectContaining({
      kind: 'pre_rewrite_low_fit_block',
      modal: expect.objectContaining({
        title: expect.stringMatching(/vaga parece muito distante/i),
      }),
    }))
    expect(mockRewriteSection).not.toHaveBeenCalled()
    expect(mockValidateRewrite).not.toHaveBeenCalled()
    expect(mockGenerateCvHighlightState).not.toHaveBeenCalled()
    expect(mockCreateCvVersion).not.toHaveBeenCalled()
    expect(mockUpdateSession).toHaveBeenLastCalledWith(session.id, expect.objectContaining({
      agentState: expect.objectContaining({
        rewriteStatus: 'failed',
        jobCompatibilityAssessment,
        targetingPlan: expect.objectContaining({
          targetRole: 'Desenvolvedor Java',
        }),
      }),
    }))
    expect(mockLogWarn).toHaveBeenCalledWith('agent.job_targeting.pre_rewrite_low_fit_blocked', expect.objectContaining({
      sessionId: session.id,
      targetRole: 'Desenvolvedor Java',
      reason: 'very_low_match_score',
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.generation_gate', expect.objectContaining({
      highlightGenerationDecision: 'blocked_low_fit',
      validationBlocked: true,
      lowFitRecoverableBlocked: true,
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.job_targeting.pipeline_trace', expect.objectContaining({
      status: 'blocked',
      rewrite: expect.objectContaining({
        sectionsAttempted: [],
        skippedReason: 'pre_rewrite_low_fit_block',
      }),
      lowFitGate: expect.objectContaining({
        preRewriteBlocked: true,
        preRewriteBlockReason: 'very_low_match_score',
      }),
    }))
  })

  it('promotes low-fit soft warnings into a recoverable block before persist_version for off-target Java vacancies', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'Cargo: Desenvolvedor Java',
      'Requisitos: Java com mais de 5 anos, Spring Boot, JPA/Hibernate, Kafka/RabbitMQ, microsserviços, Docker e CI/CD.',
    ].join('\n')
    session.agentState.rewriteStatus = 'pending'

    mockBuildTargetedRewritePlan.mockReturnValue(buildDefaultTargetingPlan({
      targetRole: 'Desenvolvedor Java',
      targetRolePositioning: {
        targetRole: 'Desenvolvedor Java',
        permission: 'must_not_claim_target_role',
        reason: 'career_fit_high_risk',
        safeRolePositioning: 'Profissional com experiência em BI, SQL, APIs REST e Git.',
        forbiddenRoleClaims: ['Desenvolvedor Java'],
      },
      rewritePermissions: {
        directClaimsAllowed: ['Git', 'APIs REST', 'SQL'],
        normalizedClaimsAllowed: [],
        bridgeClaimsAllowed: [],
        relatedButNotClaimable: [],
        forbiddenClaims: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'Docker', 'CI/CD'],
        skillsSurfaceAllowed: ['Git', 'APIs REST', 'SQL'],
      },
      coreRequirementCoverage: {
        requirements: [],
        total: 8,
        supported: 1,
        unsupported: 7,
        unsupportedSignals: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'microsserviços', 'Docker', 'CI/CD'],
        topUnsupportedSignalsForDisplay: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'microsserviços', 'Docker'],
      },
      lowFitWarningGate: {
        triggered: true,
        reason: 'too_many_unsupported_core_requirements',
        matchScore: 32,
        riskLevel: 'high',
        familyDistance: 'distant',
        explicitEvidenceCount: 1,
        unsupportedGapCount: 12,
        unsupportedGapRatio: 12 / 13,
        explicitEvidenceRatio: 1 / 13,
        coreRequirementCoverage: {
          total: 8,
          supported: 1,
          unsupported: 7,
          unsupportedSignals: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'microsserviços', 'Docker', 'CI/CD'],
          topUnsupportedSignalsForDisplay: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'microsserviços', 'Docker'],
        },
      },
    }))
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Desenvolvedor Java com foco em APIs REST, SQL e Git.',
      }, section),
    }))
    mockValidateRewrite.mockReturnValue(buildRewriteValidationResult({
      blocked: false,
      valid: false,
      softWarnings: [
        {
          severity: 'medium',
          section: 'summary',
          issueType: 'target_role_overclaim',
          message: 'O resumo targetizado passou a se apresentar diretamente como o cargo alvo sem evidência equivalente no currículo original.',
        },
        {
          severity: 'medium',
          section: 'summary',
          issueType: 'summary_skill_without_evidence',
          message: 'O resumo otimizado menciona skill sem evidência no currículo original.',
        },
      ],
      issues: [
        {
          severity: 'medium',
          section: 'summary',
          issueType: 'target_role_overclaim',
          message: 'O resumo targetizado passou a se apresentar diretamente como o cargo alvo sem evidência equivalente no currículo original.',
        },
        {
          severity: 'medium',
          section: 'summary',
          issueType: 'summary_skill_without_evidence',
          message: 'O resumo otimizado menciona skill sem evidência no currículo original.',
        },
      ],
    }))

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(false)
    expect(result.validation).toEqual(expect.objectContaining({
      blocked: true,
      recoverable: true,
      promotedWarnings: expect.arrayContaining([
        expect.objectContaining({
          issueType: 'target_role_overclaim',
        }),
      ]),
    }))
    expect(result.recoverableBlock?.modal).toMatchObject({
      problemBullets: expect.arrayContaining([
        expect.stringContaining('Sem evidência direta de Java'),
        expect.stringContaining('Seu histórico atual parece mais próximo de BI, SQL e APIs REST'),
      ]),
    })
    expect(result.recoverableBlock?.modal.title).toMatch(/vaga parece muito distante/i)
    expect(result.recoverableBlock?.modal.description).toMatch(/poucos pontos comprovados/i)
    expect(mockCreateCvVersion).not.toHaveBeenCalled()
    expect(mockGenerateCvHighlightState).not.toHaveBeenCalled()
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.generation_gate', expect.objectContaining({
      workflowMode: 'job_targeting',
      highlightGenerationDecision: 'blocked_low_fit',
      validationBlocked: true,
      lowFitRecoverableBlocked: true,
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.persisted', expect.objectContaining({
      workflowMode: 'job_targeting',
      highlightDetectionInvoked: false,
      highlightStateGenerated: false,
      highlightStatePersisted: false,
      highlightStatePersistedReason: 'low_fit_recoverable_block',
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.job_targeting.low_fit_gate.evaluated', expect.objectContaining({
      sessionId: session.id,
      targetRole: 'Desenvolvedor Java',
      triggered: true,
      reason: 'too_many_unsupported_core_requirements',
      coreUnsupportedSignals: expect.arrayContaining(['Java', 'Spring Boot']),
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.job_targeting.pipeline_trace', expect.objectContaining({
      status: 'blocked',
      lowFitGate: expect.objectContaining({
        triggered: true,
        reason: 'too_many_unsupported_core_requirements',
      }),
      validation: expect.objectContaining({
        promotedWarnings: expect.arrayContaining([
          expect.objectContaining({
            issueType: 'target_role_overclaim',
          }),
        ]),
      }),
    }))
    expect(mockLogWarn).toHaveBeenCalledWith('agent.job_targeting.validation_failed', expect.objectContaining({
      issueMessages: expect.stringContaining('evidência equivalente no currículo original'),
    }))
  })

  it('blocks non-recoverable hard issues after an accepted low-fit override', () => {
    expect(shouldBlockAfterAcceptedOverride(buildRewriteValidationResult({
      blocked: true,
      hardIssues: [{
        severity: 'high',
        issueType: 'unsupported_claim',
        message: 'Claim sem evidência direta.',
      }],
      issues: [{
        severity: 'high',
        issueType: 'unsupported_claim',
        message: 'Claim sem evidência direta.',
      }],
    }) as never)).toBe(false)

    expect(shouldBlockAfterAcceptedOverride(buildRewriteValidationResult({
      blocked: true,
      hardIssues: [{
        severity: 'high',
        issueType: undefined,
        message: 'Erro estrutural sem classificação.',
      }],
      issues: [{
        severity: 'high',
        issueType: undefined,
        message: 'Erro estrutural sem classificação.',
      }],
    }) as never)).toBe(true)
  })

  it('blocks structured claim-policy issues after an accepted low-fit override', () => {
    expect(shouldBlockAfterAcceptedOverride(buildRewriteValidationResult({
      blocked: true,
      hardIssues: [{
        code: 'forbidden_term',
        severity: 'high',
        issueType: 'forbidden_claim',
        message: 'A versão declarou um requisito proibido.',
      }],
      issues: [{
        code: 'forbidden_term',
        severity: 'high',
        issueType: 'forbidden_claim',
        message: 'A versão declarou um requisito proibido.',
      }],
    }) as never)).toBe(true)

    expect(shouldBlockAfterAcceptedOverride(buildRewriteValidationResult({
      blocked: true,
      hardIssues: [{
        code: 'unsafe_direct_claim',
        severity: 'high',
        issueType: 'unsupported_claim',
        message: 'A versão transformou evidência cautelosa em claim direta.',
      }],
      issues: [{
        code: 'unsafe_direct_claim',
        severity: 'high',
        issueType: 'unsupported_claim',
        message: 'A versão transformou evidência cautelosa em claim direta.',
      }],
    }) as never)).toBe(true)
  })

  it('relaxes accepted low-fit recoverable issues into audit warnings', () => {
    const relaxed = relaxValidationForAcceptedLowFitOverride(buildRewriteValidationResult({
      blocked: true,
      valid: false,
      recoverable: true,
      hardIssues: [{
        severity: 'high',
        issueType: 'target_role_overclaim',
        message: 'O resumo assumiu o cargo alvo.',
      }],
      issues: [{
        severity: 'high',
        issueType: 'target_role_overclaim',
        message: 'O resumo assumiu o cargo alvo.',
      }],
    }) as never)

    expect(relaxed).toEqual(expect.objectContaining({
      blocked: false,
      recoverable: false,
      hardIssues: [],
      softWarnings: expect.arrayContaining([
        expect.objectContaining({
          issueType: 'target_role_overclaim',
          severity: 'medium',
        }),
      ]),
    }))
  })

  it('does not relax structured claim-policy issues for accepted low-fit overrides', () => {
    const relaxed = relaxValidationForAcceptedLowFitOverride(buildRewriteValidationResult({
      blocked: true,
      valid: false,
      recoverable: true,
      hardIssues: [{
        code: 'forbidden_term',
        severity: 'high',
        issueType: 'forbidden_claim',
        message: 'Structured forbidden term.',
      }],
      issues: [{
        code: 'forbidden_term',
        severity: 'high',
        issueType: 'forbidden_claim',
        message: 'Structured forbidden term.',
      }],
    }) as never)

    expect(relaxed).toEqual(expect.objectContaining({
      blocked: true,
      valid: false,
      hardIssues: [
        expect.objectContaining({
          code: 'forbidden_term',
          issueType: 'forbidden_claim',
          severity: 'high',
        }),
      ],
    }))
  })

  it('builds a conservative fallback CV state for accepted low-fit overrides', () => {
    const fallback = buildAcceptedLowFitFallbackCvState({
      originalCvState: buildCvState(),
      targetingPlan: buildDefaultTargetingPlan({
        safeTargetingEmphasis: {
          safeDirectEmphasis: ['SQL', 'APIs REST', 'Git', 'modelagem de dados', 'Power BI'],
          cautiousBridgeEmphasis: [],
          forbiddenDirectClaims: ['Java', 'Spring Boot', 'Docker'],
        },
      }),
    } as never)

    expect(fallback.summary).toContain('SQL')
    expect(fallback.summary).toContain('APIs REST')
    expect(fallback.summary).not.toContain('Java')
    expect(fallback.summary).not.toContain('Spring Boot')
  })

  it('does not re-block accepted low-fit overrides and skips highlight blocking after confirmation', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'Cargo: Desenvolvedor Java',
      'Requisitos: Java com mais de 5 anos, Spring Boot, JPA/Hibernate, Kafka/RabbitMQ, microsserviços, Docker e CI/CD.',
    ].join('\n')
    session.agentState.rewriteStatus = 'pending'

    mockBuildTargetedRewritePlan.mockReturnValue(buildDefaultTargetingPlan({
      targetRole: 'Desenvolvedor Java',
      safeTargetingEmphasis: {
        safeDirectEmphasis: ['Git', 'APIs REST', 'SQL', 'modelagem de dados'],
        cautiousBridgeEmphasis: [],
        forbiddenDirectClaims: ['Java', 'Spring Boot', 'Docker', 'CI/CD'],
      },
      targetRolePositioning: {
        targetRole: 'Desenvolvedor Java',
        permission: 'must_not_claim_target_role',
        reason: 'career_fit_high_risk',
        safeRolePositioning: 'Profissional com experiência em BI, SQL, APIs REST e Git.',
        forbiddenRoleClaims: ['Desenvolvedor Java'],
      },
      rewritePermissions: {
        directClaimsAllowed: ['Git', 'APIs REST', 'SQL'],
        normalizedClaimsAllowed: [],
        bridgeClaimsAllowed: [],
        relatedButNotClaimable: [],
        forbiddenClaims: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'Docker', 'CI/CD'],
        skillsSurfaceAllowed: ['Git', 'APIs REST', 'SQL'],
      },
      coreRequirementCoverage: {
        requirements: [],
        total: 8,
        supported: 1,
        unsupported: 7,
        unsupportedSignals: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'microsserviços', 'Docker', 'CI/CD'],
        topUnsupportedSignalsForDisplay: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'microsserviços', 'Docker'],
      },
      lowFitWarningGate: {
        triggered: true,
        reason: 'too_many_unsupported_core_requirements',
        matchScore: 32,
        riskLevel: 'high',
        familyDistance: 'distant',
        explicitEvidenceCount: 1,
        unsupportedGapCount: 12,
        unsupportedGapRatio: 12 / 13,
        explicitEvidenceRatio: 1 / 13,
        coreRequirementCoverage: {
          total: 8,
          supported: 1,
          unsupported: 7,
          unsupportedSignals: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'microsserviços', 'Docker', 'CI/CD'],
          topUnsupportedSignalsForDisplay: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Kafka/RabbitMQ', 'microsserviços', 'Docker'],
        },
      },
    }))
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Desenvolvedor Java com foco em APIs REST, SQL e Git.',
      }, section),
    }))
    mockValidateRewrite
      .mockReturnValueOnce(buildRewriteValidationResult({
        blocked: true,
        valid: false,
        recoverable: true,
        hardIssues: [{
          severity: 'high',
          section: 'summary',
          issueType: 'target_role_overclaim',
          message: 'O resumo targetizado passou a se apresentar diretamente como o cargo alvo sem evidência equivalente no currículo original.',
        }],
        softWarnings: [],
        issues: [{
          severity: 'high',
          section: 'summary',
          issueType: 'target_role_overclaim',
          message: 'O resumo targetizado passou a se apresentar diretamente como o cargo alvo sem evidência equivalente no currículo original.',
        }],
      }))
      .mockReturnValueOnce(buildRewriteValidationResult({
        blocked: true,
        valid: false,
        recoverable: true,
        hardIssues: [{
          severity: 'high',
          section: 'summary',
          issueType: 'unsupported_claim',
          message: 'O resumo otimizado ainda menciona claim sem evidência direta no currículo original.',
        }],
        softWarnings: [],
        issues: [{
          severity: 'high',
          section: 'summary',
          issueType: 'unsupported_claim',
          message: 'O resumo otimizado ainda menciona claim sem evidência direta no currículo original.',
        }],
      }))

    const result = await runJobTargetingPipeline(session, {
      userAcceptedLowFit: true,
      overrideReason: 'pre_rewrite_low_fit_block',
      skipPreRewriteLowFitBlock: true,
      skipLowFitRecoverableBlocking: true,
    })

    expect(result.success).toBe(true)
    expect(result.acceptedLowFitFallbackUsed).toBe(true)
    expect(result.validation).toEqual(expect.objectContaining({
      blocked: false,
      recoverable: false,
      hardIssues: [],
    }))
    expect(mockCreateCvVersion).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: session.id,
      source: 'job-targeting',
    }))
    expect(mockGenerateCvHighlightState).not.toHaveBeenCalled()
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.generation_gate', expect.objectContaining({
      highlightGenerationDecision: 'skipped_after_override',
      validationBlocked: false,
      lowFitRecoverableBlocked: false,
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.persisted', expect.objectContaining({
      highlightDetectionInvoked: false,
      highlightStatePersistedReason: 'skipped_after_override',
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.job_targeting.low_fit_gate.evaluated', expect.objectContaining({
      acceptedByUser: true,
      blockingSkipped: true,
      triggered: true,
    }))
  })

  it.each([
    {
      code: 'forbidden_term',
      issueType: 'forbidden_claim',
      message: 'Structured forbidden term.',
    },
    {
      code: 'unsafe_direct_claim',
      issueType: 'unsupported_claim',
      message: 'Structured cautious claim promoted directly.',
    },
    {
      code: 'missing_claim_trace',
      issueType: 'unsupported_claim',
      message: 'Generated text missing claim trace.',
    },
    {
      code: 'unsupported_expressed_signal',
      issueType: 'unsupported_claim',
      message: 'Generated text expressed an unsupported signal.',
    },
  ] as const)('keeps accepted low-fit override blocked for structured $code issues', async ({ code, issueType, message }) => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = 'Cargo: Especialista em plataforma sem evidencia'
    session.agentState.rewriteStatus = 'pending'

    mockBuildTargetedRewritePlan.mockReturnValue(buildDefaultTargetingPlan({
      lowFitWarningGate: {
        triggered: true,
        reason: 'high_risk_off_target',
        matchScore: 32,
        riskLevel: 'high',
        familyDistance: 'distant',
        explicitEvidenceCount: 1,
        unsupportedGapCount: 10,
        unsupportedGapRatio: 10 / 11,
        explicitEvidenceRatio: 1 / 11,
        coreRequirementCoverage: {
          total: 2,
          supported: 1,
          unsupported: 1,
          unsupportedSignals: ['plataforma sem evidencia'],
          topUnsupportedSignalsForDisplay: ['plataforma sem evidencia'],
        },
      },
    }))
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Especialista em plataforma sem evidencia comprovada.',
      }, section),
    }))
    const structuredIssue = {
      code,
      severity: 'high' as const,
      section: 'summary',
      issueType,
      message,
      offendingSignal: 'plataforma sem evidencia',
      offendingText: 'Especialista em plataforma sem evidencia comprovada.',
    }
    mockValidateRewrite.mockReturnValue(buildRewriteValidationResult({
      blocked: true,
      valid: false,
      recoverable: true,
      hardIssues: [structuredIssue],
      softWarnings: [],
      issues: [structuredIssue],
    }))

    const result = await runJobTargetingPipeline(session, {
      userAcceptedLowFit: true,
      overrideReason: 'pre_rewrite_low_fit_block',
      skipPreRewriteLowFitBlock: true,
      skipLowFitRecoverableBlocking: true,
    })

    expect(result.success).toBe(false)
    expect(result.validation).toEqual(expect.objectContaining({
      blocked: true,
      hardIssues: [
        expect.objectContaining({
          code,
          issueType,
          severity: 'high',
        }),
      ],
    }))
    expect(mockCreateCvVersion).not.toHaveBeenCalled()
    expect(mockGenerateCvHighlightState).not.toHaveBeenCalled()
  })

  it('creates a synthetic recoverable issue when a low-fit vacancy has no promotable warnings but still should not auto-generate', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = 'Cargo: Desenvolvedor Java'
    session.agentState.rewriteStatus = 'pending'

    mockBuildTargetedRewritePlan.mockReturnValue(buildDefaultTargetingPlan({
      targetRole: 'Desenvolvedor Java',
      targetRolePositioning: {
        targetRole: 'Desenvolvedor Java',
        permission: 'must_not_claim_target_role',
        reason: 'career_fit_high_risk',
        safeRolePositioning: 'Profissional com experiência em BI, SQL e APIs REST.',
        forbiddenRoleClaims: ['Desenvolvedor Java'],
      },
      rewritePermissions: {
        directClaimsAllowed: ['Git', 'SQL', 'APIs REST'],
        normalizedClaimsAllowed: [],
        bridgeClaimsAllowed: [],
        relatedButNotClaimable: [],
        forbiddenClaims: ['Java', 'Spring Boot'],
        skillsSurfaceAllowed: ['Git', 'SQL', 'APIs REST'],
      },
      coreRequirementCoverage: {
        requirements: [],
        total: 6,
        supported: 1,
        unsupported: 5,
        unsupportedSignals: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Docker', 'CI/CD'],
        topUnsupportedSignalsForDisplay: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Docker', 'CI/CD'],
      },
      lowFitWarningGate: {
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
          unsupportedSignals: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Docker', 'CI/CD'],
          topUnsupportedSignalsForDisplay: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Docker', 'CI/CD'],
        },
      },
    }))
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Profissional de dados com foco em SQL, APIs REST e Git.',
      }, section),
    }))
    mockValidateRewrite.mockReturnValue(buildRewriteValidationResult())

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(false)
    expect(result.validation?.blocked).toBe(true)
    expect(result.validation?.recoverable).toBe(true)
    expect(result.validation?.hardIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        issueType: 'low_fit_target_role',
      }),
    ]))
    expect(result.recoverableBlock).toBeDefined()
    expect(mockCreateCvVersion).not.toHaveBeenCalled()
  })

  it('still returns an override token for low-fit recoverable blocks when the rewritten CV stays unchanged', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = 'Cargo: Desenvolvedor Java'
    session.agentState.rewriteStatus = 'pending'

    const originalCvState = buildCvState()

    mockBuildTargetedRewritePlan.mockReturnValue(buildDefaultTargetingPlan({
      targetRole: 'Desenvolvedor Java',
      targetRolePositioning: {
        targetRole: 'Desenvolvedor Java',
        permission: 'must_not_claim_target_role',
        reason: 'career_fit_high_risk',
        safeRolePositioning: 'Profissional com experiência em BI, SQL e APIs REST.',
        forbiddenRoleClaims: ['Desenvolvedor Java'],
      },
      lowFitWarningGate: {
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
          unsupportedSignals: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Docker', 'CI/CD'],
          topUnsupportedSignalsForDisplay: ['Java', 'Spring Boot', 'JPA/Hibernate', 'Docker', 'CI/CD'],
        },
      },
    }))
    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput(originalCvState, section),
    }))
    mockValidateRewrite.mockReturnValue(buildRewriteValidationResult())

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(false)
    expect(result.validation?.recoverable).toBe(true)
    expect(result.recoverableBlock).toEqual(expect.objectContaining({
      status: 'validation_blocked_recoverable',
      overrideToken: expect.any(String),
    }))
    expect(mockCreateCvVersion).not.toHaveBeenCalled()
  })

  it('logs a partial pipeline trace when gap analysis fails before rewrite starts', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = 'Cargo: Analytics Engineer'

    mockAnalyzeGap.mockResolvedValue({
      output: {
        success: false,
        error: 'Gap analysis failed.',
      },
      repairAttempted: false,
    })

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(false)
    expect(mockLogInfo).toHaveBeenCalledWith('agent.job_targeting.pipeline_trace', expect.objectContaining({
      sessionId: session.id,
      userId: session.userId,
      status: 'failed',
      error: 'Gap analysis failed.',
    }))
  })

  it('preserves the previous valid optimizedCvState when job_targeting persist_version fails', async () => {
    const session = buildSession()
    const previousOptimizedCvState = {
      ...buildCvState(),
      summary: 'Resumo targetizado anterior e estavel.',
      skills: ['SQL', 'Power BI'],
    }

    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'Cargo: Analytics Engineer',
      'Responsabilidades: construir dashboards e automacoes.',
      'Requisitos: SQL, Power BI, BigQuery.',
    ].join('\n')
    session.agentState.optimizedCvState = previousOptimizedCvState
    session.agentState.optimizedAt = '2026-04-09T12:00:00.000Z'
    session.agentState.optimizationSummary = {
      changedSections: ['summary'],
      notes: ['Versao alvo anterior validada'],
      keywordCoverageImprovement: ['SQL'],
    }
    session.agentState.lastRewriteMode = 'job_targeting'

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput({
        ...buildCvState(),
        summary: 'Analytics engineer com foco em SQL, Power BI e automacao.',
      }, section),
    }))
    mockCreateCvVersion.mockRejectedValue(new Error('persist version failed'))

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(false)
    expect(session.agentState.optimizedCvState).toEqual(previousOptimizedCvState)
    expect(session.agentState.optimizedAt).toBe('2026-04-09T12:00:00.000Z')
    expect(session.agentState.optimizationSummary).toEqual({
      changedSections: ['summary'],
      notes: ['Versao alvo anterior validada'],
      keywordCoverageImprovement: ['SQL'],
    })
    expect(session.agentState.lastRewriteMode).toBe('job_targeting')
    expect(session.agentState.atsWorkflowRun).toMatchObject({
      status: 'failed',
      currentStage: 'persist_version',
      lastFailureStage: 'persist_version',
      lastFailureReason: 'persist version failed',
    })
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.persisted', expect.objectContaining({
      workflowMode: 'job_targeting',
      highlightStatePersistedReason: 'persist_version_rollback',
      highlightStatePersisted: false,
    }))
  })

  it('builds a low-confidence target role plan from freeform vacancy text while keeping the flow usable', async () => {
    const session = buildSession()
    session.agentState.workflowMode = 'job_targeting'
    session.agentState.targetJobDescription = [
      'About The Job',
      'Buscamos profissionais com forte experiência em Power BI e análise de dados.',
      'Requisitos: SQL, Power BI e dashboards executivos.',
    ].join('\n')
    session.agentState.rewriteStatus = 'pending'

    mockRewriteSection.mockImplementation(async ({ section }: { section: string }) => ({
      output: buildSuccessfulRewriteOutput(buildCvState(), section),
    }))
    mockBuildTargetedRewritePlan.mockReturnValue(buildDefaultTargetingPlan({
      targetRole: 'Vaga Alvo',
      targetRoleConfidence: 'low',
    }))

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(true)
    expect(session.agentState.targetingPlan).toMatchObject({
      targetRole: 'Vaga Alvo',
      targetRoleConfidence: 'low',
    })
  })
})
