import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fingerprintJD } from '@/lib/agent/jd-fingerprint'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getResumeTargetsForSession } from '@/lib/db/resume-targets'
import { getSession } from '@/lib/db/sessions'
import { listJobsForSession } from '@/lib/jobs/repository'
import { recordAtsReadinessCompatFieldEmission } from '@/lib/ats/scoring'
import { recordQuery } from '@/lib/observability/request-query-context'
import { logInfo, logWarn } from '@/lib/observability/structured-log'

import { GET } from './route'

const { mockRecordAtsReadinessCompatFieldEmission } = vi.hoisted(() => ({
  mockRecordAtsReadinessCompatFieldEmission: vi.fn(),
}))

vi.mock('@/lib/ats/scoring', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ats/scoring')>('@/lib/ats/scoring')
  return {
    ...actual,
    recordAtsReadinessCompatFieldEmission: mockRecordAtsReadinessCompatFieldEmission,
  }
})

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/db/resume-targets', () => ({
  getResumeTargetsForSession: vi.fn(),
}))

vi.mock('@/lib/jobs/repository', () => ({
  listJobsForSession: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  serializeError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}))

describe('session route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getResumeTargetsForSession).mockResolvedValue([])
    vi.mocked(listJobsForSession).mockResolvedValue([])
  })

  it('allows a non-Pro owner to load the history/editor snapshot', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: 'usr_123' } as never)
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_123',
      userId: 'usr_123',
      phase: 'dialog',
      stateVersion: 1,
      cvState: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '555-0100',
        summary: 'Resumo base.',
        experience: [],
        skills: ['SQL'],
        education: [],
      },
      agentState: {
        workflowMode: 'job_targeting',
        optimizedCvState: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          summary: 'Resumo otimizado.',
          experience: [],
          skills: ['SQL'],
          education: [],
        },
      },
      generatedOutput: {
        status: 'ready',
      },
      messageCount: 1,
      creditConsumed: true,
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    } as never)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.session.id).toBe('sess_123')
    expect(body.session.agentState.optimizedCvState).toBeDefined()
    expect(logWarn).not.toHaveBeenCalledWith('api.session.snapshot_forbidden', expect.anything())
    expect(logInfo).toHaveBeenCalledWith('api.session.snapshot_loaded', expect.objectContaining({
      accessScope: 'history_editor',
      requestedSessionId: 'sess_123',
      appUserId: 'usr_123',
      success: true,
    }))
  })

  it('blocks session snapshots when the authenticated user is not the owner', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: 'usr_other' } as never)
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'Forbidden',
      code: 'forbidden_owner_mismatch',
    })
  })

  it('returns a derived careerFitCheckpoint when the current target still requires confirmation', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: 'usr_123' } as never)
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_checkpoint',
      userId: 'usr_123',
      phase: 'dialog',
      stateVersion: 1,
      cvState: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '555-0100',
        linkedin: 'https://linkedin.com/in/ana',
        location: 'Sao Paulo',
        summary: 'Analista de BI com foco em SQL, dashboards e automacao.',
        experience: [{
          title: 'Analista de BI',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Criei dashboards executivos com SQL e Power BI.'],
        }],
        skills: ['SQL', 'Power BI', 'ETL'],
        education: [],
        certifications: [],
      },
      agentState: {
        workflowMode: 'job_targeting',
        parseStatus: 'parsed',
        rewriteHistory: {},
        targetJobDescription: 'Senior Platform Engineer com foco em Kubernetes, Go, Terraform e arquitetura distribuida.',
        targetFitAssessment: {
          level: 'weak',
          summary: 'O perfil atual parece pouco alinhado com a vaga-alvo neste momento.',
          reasons: ['Skill ausente ou pouco evidenciada: Kubernetes'],
          assessedAt: '2026-04-22T10:00:00.000Z',
        },
        gapAnalysis: {
          result: {
            matchScore: 34,
            missingSkills: ['Kubernetes', 'Go', 'Terraform'],
            weakAreas: ['experience', 'summary'],
            improvementSuggestions: ['Fortalecer projetos de infraestrutura antes de insistir nessa trilha.'],
          },
          analyzedAt: '2026-04-22T10:00:00.000Z',
        },
        phaseMeta: {
          careerFitWarningIssuedAt: '2026-04-22T10:05:00.000Z',
          careerFitWarningJDFingerprint: fingerprintJD('Senior Platform Engineer com foco em Kubernetes, Go, Terraform e arquitetura distribuida.'),
          careerFitWarningTargetJobDescription: 'Senior Platform Engineer com foco em Kubernetes, Go, Terraform e arquitetura distribuida.',
        },
      },
      generatedOutput: {
        status: 'idle',
      },
      messageCount: 2,
      creditConsumed: false,
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-22T10:05:00.000Z',
    } as never)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_checkpoint'),
      { params: { id: 'sess_checkpoint' } },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.session.agentState.careerFitCheckpoint).toMatchObject({
      status: 'pending_confirmation',
      targetJobDescription: 'Senior Platform Engineer com foco em Kubernetes, Go, Terraform e arquitetura distribuida.',
      summary: 'Desalinhamento estrutural para a vaga.',
      assessedAt: '2026-04-22T10:00:00.000Z',
    })
    expect(body.session.agentState.careerFitCheckpoint.reasons).toEqual(expect.arrayContaining([
      'Skill ausente ou pouco evidenciada: Kubernetes',
      'Seu histórico atual parece mais alinhado a data, enquanto esta vaga pede um foco mais claro em devops.',
    ]))
  })

  it('omits the careerFitCheckpoint after the current target was already explicitly confirmed', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: 'usr_123' } as never)
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_confirmed_checkpoint',
      userId: 'usr_123',
      phase: 'dialog',
      stateVersion: 1,
      cvState: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '555-0100',
        linkedin: 'https://linkedin.com/in/ana',
        location: 'Sao Paulo',
        summary: 'Analista de BI com foco em SQL.',
        experience: [],
        skills: ['SQL'],
        education: [],
        certifications: [],
      },
      agentState: {
        workflowMode: 'job_targeting',
        parseStatus: 'parsed',
        rewriteHistory: {},
        targetJobDescription: 'Senior Platform Engineer com foco em Kubernetes, Go, Terraform e arquitetura distribuida.',
        targetFitAssessment: {
          level: 'weak',
          summary: 'O perfil atual parece pouco alinhado com a vaga-alvo neste momento.',
          reasons: ['Skill ausente ou pouco evidenciada: Kubernetes'],
          assessedAt: '2026-04-22T10:00:00.000Z',
        },
        phaseMeta: {
          careerFitWarningIssuedAt: '2026-04-22T10:05:00.000Z',
          careerFitWarningJDFingerprint: fingerprintJD('Senior Platform Engineer com foco em Kubernetes, Go, Terraform e arquitetura distribuida.'),
          careerFitWarningTargetJobDescription: 'Senior Platform Engineer com foco em Kubernetes, Go, Terraform e arquitetura distribuida.',
          careerFitOverrideConfirmedAt: '2026-04-22T10:06:00.000Z',
          careerFitOverrideTargetJobDescription: 'Senior Platform Engineer com foco em Kubernetes, Go, Terraform e arquitetura distribuida.',
        },
      },
      generatedOutput: {
        status: 'idle',
      },
      messageCount: 2,
      creditConsumed: false,
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-22T10:06:00.000Z',
    } as never)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_confirmed_checkpoint'),
      { params: { id: 'sess_confirmed_checkpoint' } },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.session.agentState.careerFitCheckpoint).toBeNull()
  })

  it('returns the canonical ATS Readiness contract for ATS enhancement sessions', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: 'usr_123' } as never)
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_123',
      userId: 'usr_123',
      phase: 'dialog',
      stateVersion: 1,
      cvState: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '555-0100',
        linkedin: 'https://linkedin.com/in/ana',
        location: 'Sao Paulo',
        summary: 'Resumo base com SQL e BI.',
        experience: [{
          title: 'Analista',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Criei dashboards e reduzi o tempo de reporte em 20%.'],
        }],
        skills: ['SQL', 'Power BI', 'ETL'],
        education: [{
          degree: 'Bacharel em Sistemas',
          institution: 'USP',
          year: '2020',
        }],
        certifications: [],
      },
      agentState: {
        workflowMode: 'ats_enhancement',
        rewriteValidation: {
          valid: true,
          issues: [],
        },
        optimizationSummary: {
          changedSections: ['summary', 'experience', 'skills'],
          notes: ['Resumo e experiência reforçados para ATS.'],
          keywordCoverageImprovement: ['SQL', 'Power BI'],
        },
        optimizedCvState: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          linkedin: 'https://linkedin.com/in/ana',
          location: 'Sao Paulo',
          summary: 'Resumo otimizado com maior clareza, SQL, BI e foco em indicadores para decisao executiva.',
          experience: [{
            title: 'Analista',
            company: 'Acme',
            startDate: '2022',
            endDate: '2024',
            bullets: ['Estruturei dashboards executivos e reduzi o tempo de reporte em 25%.'],
          }],
          skills: ['SQL', 'Power BI', 'ETL', 'Dashboards'],
          education: [{
            degree: 'Bacharel em Sistemas',
            institution: 'USP',
            year: '2020',
          }],
          certifications: [],
        },
      },
      generatedOutput: {
        status: 'ready',
      },
      internalHeuristicAtsScore: {
        total: 74,
        breakdown: {
          format: 16,
          structure: 15,
          contact: 8,
          keywords: 18,
          impact: 17,
        },
        issues: [],
        suggestions: [],
      },
      messageCount: 4,
      creditConsumed: true,
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    } as never)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.session.atsReadiness).toMatchObject({
      productLabel: 'ATS Readiness Score',
      scoreStatus: 'final',
      rawInternalConfidence: expect.any(String),
      display: {
        mode: 'exact',
        badgeTextPtBr: 'Final',
      },
    })
    expect(body.session.agentState.atsReadiness).toMatchObject({
      productLabel: 'ATS Readiness Score',
      scoreStatus: 'final',
    })
    expect(body.session.atsReadiness.displayedReadinessScoreAfter).toBeGreaterThanOrEqual(
      body.session.atsReadiness.displayedReadinessScoreBefore,
    )
    expect(body.session.atsReadiness.displayedReadinessScoreAfter).toBeGreaterThanOrEqual(89)
    expect(vi.mocked(recordAtsReadinessCompatFieldEmission)).toHaveBeenCalledWith({
      surface: 'session_response',
      workflowMode: 'ats_enhancement',
      hasCanonicalReadiness: true,
      contractVersion: 2,
    })
    expect(logInfo).toHaveBeenCalledWith(
      'db.request_queries',
      expect.objectContaining({
        requestMethod: 'GET',
        requestPath: '/api/session/sess_123',
        queryCount: 0,
      }),
    )
    expect(logInfo).toHaveBeenCalledWith('agent.highlight_state.response_evaluated', expect.objectContaining({
      surface: 'session_route',
      previewLocked: false,
      highlightStateResponseKind: 'omitted_artifact_missing',
      highlightStateAvailable: false,
      highlightStateReturned: false,
      highlightStateOmittedReason: 'artifact_missing',
    }))
  })

  it('omits highlightState when the optimized preview is locked', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: 'usr_123' } as never)
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_locked',
      userId: 'usr_123',
      phase: 'dialog',
      stateVersion: 1,
      cvState: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '555-0100',
        summary: 'Resumo base com SQL e BI.',
        experience: [],
        skills: ['SQL'],
        education: [],
      },
      agentState: {
        workflowMode: 'ats_enhancement',
        optimizedCvState: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          summary: 'Resumo otimizado real.',
          experience: [],
          skills: ['SQL'],
          education: [],
        },
        highlightState: {
          source: 'rewritten_cv_state',
          version: 2,
          highlightSource: 'ats_enhancement',
          highlightGeneratedAt: '2026-04-22T12:00:00.000Z',
          generatedAt: '2026-04-22T12:00:00.000Z',
          resolvedHighlights: [{
            itemId: 'summary_0',
            section: 'summary',
            ranges: [{ start: 0, end: 6, reason: 'ats_strength' }],
          }],
        },
      },
      generatedOutput: {
        status: 'ready',
        previewAccess: {
          locked: true,
          blurred: true,
          canViewRealContent: false,
          requiresUpgrade: true,
          requiresRegenerationAfterUnlock: true,
          reason: 'free_trial_locked',
          message: 'locked',
        },
      },
      messageCount: 1,
      creditConsumed: false,
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    } as never)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_locked'),
      { params: { id: 'sess_locked' } },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.session.agentState.optimizedCvState).toMatchObject({
      fullName: 'Preview bloqueado',
    })
    expect(body.session.agentState.highlightState).toBeUndefined()
    expect(logInfo).toHaveBeenCalledWith('agent.highlight_state.response_evaluated', expect.objectContaining({
      surface: 'session_route',
      previewLocked: true,
      highlightStateResponseKind: 'omitted_preview_locked',
      highlightStateAvailable: true,
      highlightStateReturned: false,
      highlightStateOmittedReason: 'preview_locked',
      highlightStateResolvedRangeCount: 1,
    }))
  })

  it('keeps an empty highlight artifact visible and classifies it as present_empty', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: 'usr_123' } as never)
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_empty_highlight',
      userId: 'usr_123',
      phase: 'dialog',
      stateVersion: 1,
      cvState: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '555-0100',
        summary: 'Resumo base com SQL e BI.',
        experience: [],
        skills: ['SQL'],
        education: [],
      },
      agentState: {
        workflowMode: 'ats_enhancement',
        optimizedCvState: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          summary: 'Resumo otimizado real.',
          experience: [],
          skills: ['SQL'],
          education: [],
        },
        highlightState: {
          source: 'rewritten_cv_state',
          version: 2,
          highlightSource: 'ats_enhancement',
          highlightGeneratedAt: '2026-04-22T12:00:00.000Z',
          generatedAt: '2026-04-22T12:00:00.000Z',
          resolvedHighlights: [],
        },
      },
      generatedOutput: {
        status: 'ready',
      },
      messageCount: 1,
      creditConsumed: false,
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    } as never)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_empty_highlight'),
      { params: { id: 'sess_empty_highlight' } },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.session.agentState.highlightState).toEqual({
      source: 'rewritten_cv_state',
      version: 2,
      highlightSource: 'ats_enhancement',
      highlightGeneratedAt: '2026-04-22T12:00:00.000Z',
      generatedAt: '2026-04-22T12:00:00.000Z',
      resolvedHighlights: [],
    })
    expect(logInfo).toHaveBeenCalledWith('agent.highlight_state.response_evaluated', expect.objectContaining({
      surface: 'session_route',
      previewLocked: false,
      highlightStateResponseKind: 'present_empty',
      highlightStateReturned: true,
      highlightStateOmittedReason: 'not_applicable',
      highlightStateResolvedRangeCount: 0,
      highlightStateVisibleRangeCount: 0,
      highlightStateRendererMismatch: false,
    }))
  })

  it('classifies a visible highlight artifact as present_non_empty on the session route', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: 'usr_123' } as never)
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_visible_highlight',
      userId: 'usr_123',
      phase: 'dialog',
      stateVersion: 1,
      cvState: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '555-0100',
        summary: 'Resumo base com SQL e BI.',
        experience: [],
        skills: ['SQL'],
        education: [],
      },
      agentState: {
        workflowMode: 'ats_enhancement',
        optimizedCvState: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          summary: 'Resumo otimizado real.',
          experience: [],
          skills: ['SQL'],
          education: [],
        },
        highlightState: {
          source: 'rewritten_cv_state',
          version: 2,
          highlightSource: 'ats_enhancement',
          highlightGeneratedAt: '2026-04-22T12:00:00.000Z',
          generatedAt: '2026-04-22T12:00:00.000Z',
          resolvedHighlights: [{
            itemId: 'summary_0',
            section: 'summary',
            ranges: [{ start: 0, end: 6, reason: 'ats_strength' }],
          }],
        },
      },
      generatedOutput: {
        status: 'ready',
      },
      messageCount: 1,
      creditConsumed: false,
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    } as never)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_visible_highlight'),
      { params: { id: 'sess_visible_highlight' } },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.session.agentState.highlightState?.resolvedHighlights).toHaveLength(1)
    expect(logInfo).toHaveBeenCalledWith('agent.highlight_state.response_evaluated', expect.objectContaining({
      surface: 'session_route',
      previewLocked: false,
      highlightStateResponseKind: 'present_non_empty',
      highlightStateReturned: true,
      highlightStateResolvedRangeCount: 1,
      highlightStateVisibleRangeCount: 1,
      highlightStateRendererMismatch: false,
    }))
  })

  it('derives a canonical ATS Readiness fallback for legacy ATS sessions without persisted atsReadiness', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: 'usr_123' } as never)
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_legacy',
      userId: 'usr_123',
      phase: 'dialog',
      stateVersion: 1,
      cvState: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '555-0100',
        summary: 'Resumo base com SQL e BI.',
        experience: [{
          title: 'Analista',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Criei dashboards e reduzi o tempo de reporte em 20%.'],
        }],
        skills: ['SQL', 'Power BI', 'ETL'],
        education: [{
          degree: 'Bacharel em Sistemas',
          institution: 'USP',
          year: '2020',
        }],
      },
      agentState: {
        workflowMode: 'ats_enhancement',
      },
      generatedOutput: {
        status: 'idle',
      },
      internalHeuristicAtsScore: {
        total: 12,
        breakdown: {
          format: 2,
          structure: 2,
          contact: 2,
          keywords: 3,
          impact: 3,
        },
        issues: [],
        suggestions: [],
      },
      messageCount: 1,
      creditConsumed: false,
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    } as never)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_legacy'),
      { params: { id: 'sess_legacy' } },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.session.atsReadiness).toMatchObject({
      contractVersion: 2,
      productLabel: 'ATS Readiness Score',
      scoreStatus: 'final',
    })
    expect(body.session.atsReadiness.displayedReadinessScoreBefore).not.toBe(12)
  })

  it('returns an estimated ATS Readiness range when the optimized score cannot be stated exactly', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: 'usr_123' } as never)
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_estimated',
      userId: 'usr_123',
      phase: 'dialog',
      stateVersion: 1,
      cvState: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '555-0100',
        summary: 'Resumo base com SQL e BI.',
        experience: [{
          title: 'Analista',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Criei dashboards e reduzi o tempo de reporte em 20%.'],
        }],
        skills: ['SQL', 'Power BI', 'ETL'],
        education: [{
          degree: 'Bacharel em Sistemas',
          institution: 'USP',
          year: '2020',
        }],
      },
      agentState: {
        workflowMode: 'ats_enhancement',
        rewriteValidation: {
          valid: false,
          issues: [{ severity: 'high', message: 'Unsupported claims.', section: 'summary' }],
        },
        optimizationSummary: {
          changedSections: ['summary'],
          notes: ['Resumo alterado.'],
        },
        optimizedCvState: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          summary: 'Resumo curto',
          experience: [],
          skills: ['SQL'],
          education: [],
        },
      },
      generatedOutput: {
        status: 'ready',
      },
      messageCount: 3,
      creditConsumed: true,
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    } as never)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_estimated'),
      { params: { id: 'sess_estimated' } },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.session.atsReadiness).toMatchObject({
      scoreStatus: 'estimated_range',
      display: {
        mode: 'estimated_range',
        badgeTextPtBr: 'Estimado',
        helperTextPtBr: 'Faixa estimada com base na otimização concluída.',
      },
    })
    expect(body.session.atsReadiness.display.formattedScorePtBr).toMatch(/^\d+(–\d+)?$/)
    expect(body.session.atsReadiness.display.estimatedRangeMin).toBeGreaterThanOrEqual(89)
    expect(body.session.atsReadiness.display.estimatedRangeMax).toBeLessThanOrEqual(95)
  })

  it('emits a threshold warning when mocked DB work exceeds the configured limit', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: 'usr_123' } as never)
    vi.mocked(getSession).mockImplementation(async () => {
      for (let index = 0; index < 16; index += 1) {
        recordQuery(`GET /rest/v1/sessions?id=eq.${index}&select=*`)
      }

      return {
        id: 'sess_warn',
        userId: 'usr_123',
        phase: 'dialog',
        stateVersion: 1,
        cvState: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          summary: 'Resumo base.',
          experience: [],
          skills: ['SQL'],
          education: [],
        },
        agentState: {
          workflowMode: 'dialog',
        },
        generatedOutput: {
          status: 'idle',
        },
        internalHeuristicAtsScore: undefined,
        messageCount: 1,
        creditConsumed: false,
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      } as never
    })

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_warn'),
      { params: { id: 'sess_warn' } },
    )

    expect(response.status).toBe(200)
    expect(logWarn).toHaveBeenCalledWith(
      'db.n_plus_one_threshold_exceeded',
      expect.objectContaining({
        requestMethod: 'GET',
        requestPath: '/api/session/sess_warn',
        queryCount: 16,
        threshold: 15,
        uniqueQueryPatternCount: 1,
        repeatedQueryPatternCount: 1,
        maxRepeatedPatternCount: 16,
        suspectedNPlusOne: true,
        sampledQueries: expect.any(Array),
        topRepeatedQueryPatterns: [{
          fingerprint: 'GET /rest/v1/sessions?id=eq.:number&select=*',
          sample: 'GET /rest/v1/sessions?id=eq.0&select=*',
          count: 16,
        }],
      }),
    )
  })

  it('does not flag suspected N+1 when high DB activity is diverse', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: 'usr_123' } as never)
    vi.mocked(getSession).mockImplementation(async () => {
      for (let index = 0; index < 16; index += 1) {
        recordQuery(`GET /rest/v1/resource_${index}?id=eq.${index}`)
      }

      return {
        id: 'sess_diverse',
        userId: 'usr_123',
        phase: 'dialog',
        stateVersion: 1,
        cvState: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          summary: 'Resumo base.',
          experience: [],
          skills: ['SQL'],
          education: [],
        },
        agentState: {
          workflowMode: 'dialog',
        },
        generatedOutput: {
          status: 'idle',
        },
        internalHeuristicAtsScore: undefined,
        messageCount: 1,
        creditConsumed: false,
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      } as never
    })

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_diverse'),
      { params: { id: 'sess_diverse' } },
    )

    expect(response.status).toBe(200)
    expect(logWarn).toHaveBeenCalledWith(
      'db.query_count_threshold_exceeded',
      expect.objectContaining({
        requestMethod: 'GET',
        requestPath: '/api/session/sess_diverse',
        queryCount: 16,
        threshold: 15,
        uniqueQueryPatternCount: 16,
        repeatedQueryPatternCount: 0,
        maxRepeatedPatternCount: 0,
        suspectedNPlusOne: false,
        topRepeatedQueryPatterns: [],
      }),
    )
  })
})
