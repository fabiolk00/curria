import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session } from '@/types/agent'
import type { CVState } from '@/types/cv'

import { runAtsEnhancementPipeline } from '@/lib/agent/ats-enhancement-pipeline'
import { runJobTargetingPipeline } from '@/lib/agent/job-targeting-pipeline'
import { rewriteResumeFull } from '@/lib/agent/tools/rewrite-resume-full'

const {
  mockAnalyzeAtsGeneral,
  mockAnalyzeGap,
  mockRewriteSection,
  mockValidateRewrite,
  mockCreateCvVersion,
  mockUpdateSession,
  mockLogInfo,
  mockLogWarn,
  mockLogError,
  mockRecordPremiumBulletsDetected,
  mockRecordMetricRegressionDetected,
  mockRecordRecoveryPathSelected,
  mockRecordFinalMetricPreservationResult,
} = vi.hoisted(() => ({
  mockAnalyzeAtsGeneral: vi.fn(),
  mockAnalyzeGap: vi.fn(),
  mockRewriteSection: vi.fn(),
  mockValidateRewrite: vi.fn(),
  mockCreateCvVersion: vi.fn(),
  mockUpdateSession: vi.fn(),
  mockLogInfo: vi.fn(),
  mockLogWarn: vi.fn(),
  mockLogError: vi.fn(),
  mockRecordPremiumBulletsDetected: vi.fn(),
  mockRecordMetricRegressionDetected: vi.fn(),
  mockRecordRecoveryPathSelected: vi.fn(),
  mockRecordFinalMetricPreservationResult: vi.fn(),
}))

vi.mock('@/lib/agent/tools/ats-analysis', () => ({
  analyzeAtsGeneral: mockAnalyzeAtsGeneral,
}))

vi.mock('@/lib/agent/tools/gap-analysis', () => ({
  analyzeGap: mockAnalyzeGap,
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

vi.mock('@/lib/agent/tools/metric-impact-observability', () => ({
  recordPremiumBulletsDetected: mockRecordPremiumBulletsDetected,
  recordMetricRegressionDetected: mockRecordMetricRegressionDetected,
  recordRecoveryPathSelected: mockRecordRecoveryPathSelected,
  recordFinalMetricPreservationResult: mockRecordFinalMetricPreservationResult,
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

describe('ATS enhancement reliability hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateSession.mockResolvedValue(undefined)
    mockCreateCvVersion.mockResolvedValue(undefined)
    mockValidateRewrite.mockReturnValue({ valid: true, issues: [] })
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
    expect(summaryCall?.instructions).toContain('Use 4 to 6 concise lines')
    expect(summaryCall?.instructions).toContain('do not flatten the profile into generic claims')
    expect(experienceCall?.instructions).toContain('Prefira clareza com densidade a brevidade excessiva.')
    expect(experienceCall?.instructions).toContain('Every bullet must start with a strong action verb in pt-BR')
    expect(experienceCall?.instructions).toContain('Do not merge, trim, or generalize bullets')
    expect(skillsCall?.instructions).toContain('do not replace specific tools, platforms, or methods with vague umbrella labels')
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
    expect(mockRecordPremiumBulletsDetected).toHaveBeenCalledWith(expect.objectContaining({
      workflowMode: 'ats_enhancement',
      sessionId: session.id,
    }))
    expect(mockRecordMetricRegressionDetected).toHaveBeenCalledWith(expect.objectContaining({
      workflowMode: 'ats_enhancement',
      regressionCount: 0,
    }))
    expect(mockRecordFinalMetricPreservationResult).toHaveBeenCalledWith(expect.objectContaining({
      workflowMode: 'ats_enhancement',
      recoveryPath: 'none',
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.ats_enhancement.started', expect.any(Object))
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
    expect(mockLogWarn).toHaveBeenCalledWith('agent.ats_enhancement.validation_recovered', expect.objectContaining({
      workflowMode: 'ats_enhancement',
      recoveryKind: 'smart_repair',
    }))
    expect(mockRecordRecoveryPathSelected).not.toHaveBeenCalled()
    expect(mockLogInfo).toHaveBeenCalledWith('agent.ats_enhancement.completed', expect.objectContaining({
      workflowMode: 'ats_enhancement',
      success: true,
      issueCount: 0,
      recoveredIssueCount: 2,
      recoveredIssueSections: 'skills, summary',
    }))
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
  })

  it('reverts generic ATS experience rewrites that drop a strong 15% LATAM quality metric', async () => {
    const session = buildSession()
    session.cvState.experience = [{
      title: 'Senior Business Intelligence',
      company: 'Grupo Positivo',
      startDate: '2025',
      endDate: 'present',
      bullets: ['Aumentei em 15% os indicadores de qualidade de produção na LATAM com dashboards e governança analítica.'],
    }]

    const { validateRewrite: actualValidateRewrite } = await vi.importActual<typeof import('@/lib/agent/tools/validate-rewrite')>(
      '@/lib/agent/tools/validate-rewrite',
    )

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

    mockValidateRewrite.mockImplementation(actualValidateRewrite)

    const result = await runAtsEnhancementPipeline(session)

    expect(result.success).toBe(true)
    expect(session.agentState.optimizedCvState?.experience).toEqual(session.cvState.experience)
    expect(mockRecordMetricRegressionDetected).toHaveBeenCalledWith(expect.objectContaining({
      workflowMode: 'ats_enhancement',
      regressionCount: 1,
      percentMetricLost: true,
      scopeLost: true,
    }))
    expect(mockRecordRecoveryPathSelected).toHaveBeenCalledWith(expect.objectContaining({
      workflowMode: 'ats_enhancement',
      path: 'smart_repair',
      regressionCount: 1,
    }))
    expect(mockRecordFinalMetricPreservationResult).toHaveBeenCalledWith(expect.objectContaining({
      workflowMode: 'ats_enhancement',
      recoveryPath: 'smart_repair',
      premiumBulletCountOriginal: 1,
      premiumBulletCountFinal: 1,
      metricPreservationStatus: 'full',
    }))
    const serializedObservabilityCalls = JSON.stringify(mockRecordMetricRegressionDetected.mock.calls)
      + JSON.stringify(mockRecordRecoveryPathSelected.mock.calls)
      + JSON.stringify(mockRecordFinalMetricPreservationResult.mock.calls)
    expect(serializedObservabilityCalls).not.toContain('Aumentei em 15%')
    expect(serializedObservabilityCalls).not.toContain('LATAM com dashboards')
    expect(session.agentState.optimizationSummary?.notes).toContain(
      'Experiência revertida para a versão original após validação conservadora.',
    )
    expect(mockLogWarn).toHaveBeenCalledWith('agent.ats_enhancement.validation_recovered', expect.objectContaining({
      workflowMode: 'ats_enhancement',
      recoveryKind: 'smart_repair',
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

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(true)
    expect(session.agentState.workflowMode).toBe('job_targeting')
    expect(session.agentState.targetingPlan).toMatchObject({
      targetRole: expect.any(String),
      targetRoleConfidence: expect.any(String),
    })
    expect(session.agentState.lastRewriteMode).toBe('job_targeting')
    expect(mockCreateCvVersion).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: session.id,
      source: 'job-targeting',
    }))
    expect(mockLogInfo).toHaveBeenCalledWith('agent.job_targeting.completed', expect.objectContaining({
      workflowMode: 'job_targeting',
      success: true,
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
      targetRole: 'Analista De BI',
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

    const result = await runJobTargetingPipeline(session)

    expect(result.success).toBe(true)
    expect(session.agentState.targetingPlan).toMatchObject({
      targetRole: 'Vaga Alvo',
      targetRoleConfidence: 'low',
    })
  })
})
