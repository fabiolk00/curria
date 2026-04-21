import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getResumeTargetsForSession } from '@/lib/db/resume-targets'
import { getSession } from '@/lib/db/sessions'
import { listJobsForSession } from '@/lib/jobs/repository'
import { recordAtsReadinessCompatFieldEmission } from '@/lib/ats/scoring'

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

describe('session route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getResumeTargetsForSession).mockResolvedValue([])
    vi.mocked(listJobsForSession).mockResolvedValue([])
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
})
