import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getSession } from '@/lib/db/sessions'

import { GET } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
}))

describe('session comparison route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns unauthorized when no app user is resolved', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/comparison'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns not found when the session is missing or belongs to another user', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
    } as Awaited<ReturnType<typeof getCurrentAppUser>>)
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/comparison'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not found' })
  })

  it('returns conflict when the session has no optimized resume', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
    } as Awaited<ReturnType<typeof getCurrentAppUser>>)

    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_123',
      userId: 'usr_123',
      cvState: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '555-0100',
        linkedin: 'https://linkedin.com/in/ana',
        location: 'Sao Paulo',
        summary: 'Resumo base.',
        experience: [],
        skills: ['SQL'],
        education: [],
        certifications: [],
      },
      agentState: {
        workflowMode: 'ats_enhancement',
        lastRewriteMode: 'ats_enhancement',
      },
      generatedOutput: {
        status: 'idle',
      },
    } as unknown as Awaited<ReturnType<typeof getSession>>)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/comparison'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'No optimized resume found for this session.' })
  })

  it('returns ATS Readiness scores and prevents optimized lower-than-original display after enhancement', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
    } as Awaited<ReturnType<typeof getCurrentAppUser>>)

    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_123',
      userId: 'usr_123',
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
        lastRewriteMode: 'ats_enhancement',
        rewriteValidation: {
          valid: true,
          issues: [],
        },
        optimizationSummary: {
          changedSections: ['summary', 'experience', 'skills'],
          notes: ['Resumo e experiência reforçados para ATS.'],
          keywordCoverageImprovement: ['SQL'],
        },
        optimizedCvState: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          linkedin: 'https://linkedin.com/in/ana',
          location: 'Sao Paulo',
          summary: 'Resumo otimizado com maior clareza, SQL, BI e foco em indicadores para tomada de decisão executiva.',
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
    } as unknown as Awaited<ReturnType<typeof getSession>>)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/comparison'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      sessionId: 'sess_123',
      generationType: 'ATS_ENHANCEMENT',
      originalScore: {
        label: 'ATS Readiness Score',
      },
      optimizedScore: {
        label: 'ATS Readiness Score',
      },
      atsReadiness: {
        scoreStatus: 'final',
        rawInternalConfidence: expect.any(String),
      },
    })
    expect(body.optimizedScore.total).toBeGreaterThanOrEqual(body.originalScore.total)
    expect(body.optimizedScore.total).toBeGreaterThanOrEqual(89)
  })

  it('returns an estimated ATS Readiness range when the optimized score cannot be stated exactly', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
    } as Awaited<ReturnType<typeof getCurrentAppUser>>)

    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_123',
      userId: 'usr_123',
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
        lastRewriteMode: 'ats_enhancement',
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
          linkedin: 'https://linkedin.com/in/ana',
          location: 'Sao Paulo',
          summary: 'Resumo curto',
          experience: [],
          skills: ['SQL'],
          education: [],
          certifications: [],
        },
      },
      generatedOutput: {
        status: 'ready',
      },
    } as unknown as Awaited<ReturnType<typeof getSession>>)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/comparison'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      atsReadiness: {
        scoreStatus: 'estimated_range',
        display: {
          mode: 'estimated_range',
          badgeTextPtBr: 'Estimado',
        },
      },
      optimizedScore: {
        total: 89,
        label: 'ATS Readiness Score',
      },
    })
    expect(body.atsReadiness.display.formattedScorePtBr).toBe('89–90')
  })

  it('derives canonical readiness for legacy ATS sessions instead of treating old raw atsScore as the final product score', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
    } as Awaited<ReturnType<typeof getCurrentAppUser>>)

    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_legacy',
      userId: 'usr_123',
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
        certifications: [],
      },
      agentState: {
        workflowMode: 'ats_enhancement',
        lastRewriteMode: 'ats_enhancement',
        rewriteValidation: {
          valid: true,
          issues: [],
        },
        optimizationSummary: {
          changedSections: ['summary', 'experience', 'skills'],
          notes: ['Resumo e experiência reforçados para ATS.'],
          keywordCoverageImprovement: ['SQL'],
        },
        optimizedCvState: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
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
      atsScore: {
        total: 11,
        breakdown: {
          format: 2,
          structure: 2,
          contact: 2,
          keywords: 2,
          impact: 3,
        },
        issues: [],
        suggestions: [],
      },
    } as unknown as Awaited<ReturnType<typeof getSession>>)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_legacy/comparison'),
      { params: { id: 'sess_legacy' } },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.atsReadiness).toMatchObject({
      contractVersion: 2,
      productLabel: 'ATS Readiness Score',
    })
    expect(body.originalScore.total).not.toBe(11)
    expect(body.optimizedScore.total).toBeGreaterThanOrEqual(body.originalScore.total)
  })
})
