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

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session } from '@/types/agent'
import type { CVState } from '@/types/cv'

import { runAtsEnhancementPipeline } from '@/lib/agent/ats-enhancement-pipeline'
import { runJobTargetingPipeline } from '@/lib/agent/job-targeting-pipeline'
import { rewriteResumeFull } from '@/lib/agent/tools/rewrite-resume-full'
import { createExperienceBulletHighlightItemId } from '@/lib/resume/cv-highlight-artifact'
import { resetOpenAICircuitBreakerForTest } from '@/lib/openai/chat'

const {
  mockAnalyzeAtsGeneral,
  mockAnalyzeGap,
  mockBuildTargetingPlan,
  mockDeriveTargetFitAssessment,
  mockRewriteSection,
  mockValidateRewrite,
  mockGenerateCvHighlightState,
  mockCreateCvVersion,
  mockUpdateSession,
  mockLogInfo,
  mockLogWarn,
  mockLogError,
  createCompletion,
  mockRecordMetricCounter,
} = vi.hoisted(() => ({
  mockAnalyzeAtsGeneral: vi.fn(),
  mockAnalyzeGap: vi.fn(),
  mockBuildTargetingPlan: vi.fn(),
  mockDeriveTargetFitAssessment: vi.fn(),
  mockRewriteSection: vi.fn(),
  mockValidateRewrite: vi.fn(),
  mockGenerateCvHighlightState: vi.fn(),
  mockCreateCvVersion: vi.fn(),
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

vi.mock('@/lib/agent/tools/build-targeting-plan', () => ({
  buildTargetingPlan: mockBuildTargetingPlan,
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

function buildDefaultTargetingPlan(overrides: Record<string, unknown> = {}) {
  return {
    targetRole: 'Analytics Engineer',
    targetRoleConfidence: 'high',
    focusKeywords: ['sql', 'bigquery'],
    mustEmphasize: ['SQL', 'BigQuery'],
    shouldDeemphasize: [],
    missingButCannotInvent: ['BigQuery'],
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

function buildSuccessfulRewriteOutput(cvState: CVState, section: string) {
  switch (section) {
    case 'summary':
      return {
        success: true,
        rewritten_content: `${cvState.summary} com foco em impacto.`,
        section_data: `${cvState.summary} com foco em impacto.`,
        keywords_added: ['SQL'],
        changes_made: ['Resumo fortalecido'],
      }
    case 'experience':
      return {
        success: true,
        rewritten_content: 'Experiencia reestruturada.',
        section_data: cvState.experience,
        keywords_added: ['Power BI'],
        changes_made: ['Bullets consolidados'],
      }
    case 'skills':
      return {
        success: true,
        rewritten_content: cvState.skills.join(', '),
        section_data: cvState.skills,
        keywords_added: [],
        changes_made: ['Skills agrupadas'],
      }
    case 'education':
      return {
        success: true,
        rewritten_content: 'Educacao padronizada.',
        section_data: cvState.education,
        keywords_added: [],
        changes_made: ['Educacao padronizada'],
      }
    default:
      return {
        success: true,
        rewritten_content: 'Certificacoes padronizadas.',
        section_data: cvState.certifications ?? [],
        keywords_added: [],
        changes_made: ['Certificacoes padronizadas'],
      }
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
  beforeEach(() => {
    vi.clearAllMocks()
    resetOpenAICircuitBreakerForTest()
    mockUpdateSession.mockResolvedValue(undefined)
    mockCreateCvVersion.mockResolvedValue(undefined)
    mockGenerateCvHighlightState.mockImplementation(async (_cvState, context) => {
      context?.onCompleted?.(buildHighlightDetectionOutcome())
      return {
        source: 'rewritten_cv_state',
        version: 2,
        generatedAt: '2026-04-22T12:00:00.000Z',
        resolvedHighlights: [],
      }
    })
    mockValidateRewrite.mockReturnValue({ valid: true, issues: [] })
    mockBuildTargetingPlan.mockReturnValue(buildDefaultTargetingPlan())
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
    })
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
    expect(session.agentState.highlightState).toEqual({
      source: 'rewritten_cv_state',
      version: 2,
      generatedAt: '2026-04-22T12:00:00.000Z',
      resolvedHighlights: [],
    })
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
          { severity: 'medium', message: 'O resumo otimizado menciona skills sem alinhamento com a experiência reescrita.', section: 'summary' },
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

  it('preserves the previous valid optimizedCvState when ATS validation still fails after recovery attempts', async () => {
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

    expect(result.success).toBe(false)
    expect(session.agentState.optimizedCvState).toEqual(previousOptimizedCvState)
    expect(session.agentState.optimizedAt).toBe('2026-04-10T12:00:00.000Z')
    expect(session.agentState.optimizationSummary).toEqual({
      changedSections: ['summary'],
      notes: ['Versao anterior validada'],
      keywordCoverageImprovement: ['SQL'],
    })
    expect(session.agentState.lastRewriteMode).toBe('ats_enhancement')
    expect(session.agentState.atsWorkflowRun).toMatchObject({
      status: 'failed',
      currentStage: 'validation',
      lastFailureStage: 'validation',
    })
    expect(mockCreateCvVersion).not.toHaveBeenCalled()
    expect(mockLogInfo).toHaveBeenCalledWith('agent.highlight_state.persisted', expect.objectContaining({
      workflowMode: 'ats_enhancement',
      highlightDetectionInvoked: false,
      highlightStateGenerated: false,
      highlightStatePersisted: false,
      highlightStatePersistedReason: 'validation_failed',
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
      .mockReturnValueOnce({
        valid: true,
        issues: [],
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
      return {
        source: 'rewritten_cv_state',
        version: 2,
        generatedAt: '2026-04-22T12:00:00.000Z',
        resolvedHighlights: [{
          itemId: 'summary_0',
          section: 'summary',
          ranges: [{ start: 0, end: 18, reason: 'metric_impact' }],
        }],
      }
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
    expect(session.agentState.highlightState).toEqual({
      source: 'rewritten_cv_state',
      version: 2,
      generatedAt: '2026-04-22T12:00:00.000Z',
      resolvedHighlights: [{
        itemId: 'summary_0',
        section: 'summary',
        ranges: [{ start: 0, end: 18, reason: 'metric_impact' }],
      }],
    })
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
      return {
        source: 'rewritten_cv_state',
        version: 2,
        generatedAt: '2026-04-23T12:00:00.000Z',
        resolvedHighlights: [{
          itemId: 'summary_0',
          section: 'summary',
          ranges: [{ start: 0, end: 29, reason: 'ats_strength' }],
        }],
      }
    })

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(true)
    expect(session.agentState.workflowMode).toBe('job_targeting')
    expect(session.agentState.targetingPlan).toMatchObject({
      targetRole: expect.any(String),
      targetRoleConfidence: expect.any(String),
    })
    expect(session.agentState.lastRewriteMode).toBe('job_targeting')
    expect(mockGenerateCvHighlightState).toHaveBeenCalledTimes(1)
    expect(mockGenerateCvHighlightState).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        workflowMode: 'job_targeting',
        jobKeywords: ['BigQuery'],
      }),
    )
    expect(session.agentState.highlightState).toEqual({
      source: 'rewritten_cv_state',
      version: 2,
      generatedAt: '2026-04-23T12:00:00.000Z',
      resolvedHighlights: [{
        itemId: 'summary_0',
        section: 'summary',
        ranges: [{ start: 0, end: 29, reason: 'ats_strength' }],
      }],
    })
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
      validationValid: true,
      optimizedChanged: true,
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.job_targeting.completed', expect.objectContaining({
      workflowMode: 'job_targeting',
      success: true,
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
    mockBuildTargetingPlan.mockReturnValue(buildDefaultTargetingPlan({
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
    expect(mockGenerateCvHighlightState).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        workflowMode: 'job_targeting',
        jobKeywords: ['SQL', 'Power BI'],
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
    mockBuildTargetingPlan.mockReturnValue(buildDefaultTargetingPlan({
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
    mockBuildTargetingPlan.mockReturnValue(buildDefaultTargetingPlan({
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
        summary: 'Analytics profile with stakeholder communication and business translation.',
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
    mockBuildTargetingPlan.mockReturnValue(buildDefaultTargetingPlan({
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
        summary: 'Analytics profile with stakeholder communication and business translation.',
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
      mockCreateCvVersion.mockResolvedValue(undefined)
      mockValidateRewrite.mockReturnValue({ valid: true, issues: [] })
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
      validationValid: true,
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

    mockValidateRewrite.mockReturnValue({
      valid: false,
      issues: [{
        severity: 'medium',
        message: 'O resumo targetizado passou a se apresentar diretamente como o cargo alvo sem evidência equivalente no currículo original.',
        section: 'summary',
      }],
    })

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
      validationValid: false,
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
    mockBuildTargetingPlan.mockReturnValue(buildDefaultTargetingPlan({
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
