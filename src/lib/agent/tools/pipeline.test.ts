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
      retriedSections: ['experience'],
      compactedSections: ['experience'],
      sectionAttempts: expect.objectContaining({
        summary: 1,
        experience: 2,
      }),
    })
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
    expect(session.agentState.optimizedCvState?.summary).toBe(buildCvState().summary)
    expect(session.agentState.optimizedCvState?.skills).toEqual(buildCvState().skills)
    expect(session.agentState.rewriteStatus).toBe('completed')
    expect(session.agentState.atsWorkflowRun).toMatchObject({
      status: 'completed',
      currentStage: 'persist_version',
    })
    expect(mockCreateCvVersion).toHaveBeenCalledTimes(1)
    expect(mockLogWarn).toHaveBeenCalledWith('agent.ats_enhancement.validation_recovered', expect.objectContaining({
      workflowMode: 'ats_enhancement',
      recoveryKind: 'conservative_fallback',
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
