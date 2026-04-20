import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getSession } from '@/lib/db/sessions'
import { analyzeAtsGeneral } from '@/lib/agent/tools/ats-analysis'

import { GET } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/agent/tools/ats-analysis', () => ({
  analyzeAtsGeneral: vi.fn(),
}))

describe('session comparison route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('recomputes ATS scores for both original and optimized resumes on the dedicated compare route', async () => {
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
        experience: [{
          title: 'Analista',
          company: 'Acme',
          startDate: '2022',
          endDate: '2024',
          bullets: ['Criei dashboards.'],
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
        optimizedCvState: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          linkedin: 'https://linkedin.com/in/ana',
          location: 'Sao Paulo',
          summary: 'Resumo otimizado.',
          experience: [{
            title: 'Analista',
            company: 'Acme',
            startDate: '2022',
            endDate: '2024',
            bullets: ['Estruturei dashboards executivos com foco em indicadores.'],
          }],
          skills: ['SQL', 'Power BI', 'ETL', 'Dashboards'],
          education: [{
            degree: 'Bacharel em Sistemas',
            institution: 'USP',
            year: '2020',
          }],
          certifications: [],
        },
        optimizationSummary: {
          changedSections: ['summary', 'experience', 'skills'],
          notes: ['Resumo e experiência reforçados para ATS.'],
        },
      },
    } as unknown as Awaited<ReturnType<typeof getSession>>)

    vi.mocked(analyzeAtsGeneral)
      .mockResolvedValueOnce({
        success: true,
        result: {
          overallScore: 58,
          structureScore: 70,
          clarityScore: 60,
          impactScore: 40,
          keywordCoverageScore: 55,
          atsReadabilityScore: 65,
          issues: [],
          recommendations: [],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        result: {
          overallScore: 71,
          structureScore: 84,
          clarityScore: 73,
          impactScore: 58,
          keywordCoverageScore: 69,
          atsReadabilityScore: 72,
          issues: [],
          recommendations: [],
        },
      })

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/comparison'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(analyzeAtsGeneral).toHaveBeenCalledTimes(2)
    expect(await response.json()).toMatchObject({
      sessionId: 'sess_123',
      generationType: 'ATS_ENHANCEMENT',
      originalScore: {
        total: 58,
        label: 'Score ATS',
      },
      optimizedScore: {
        total: 71,
        label: 'Score ATS',
      },
    })
  })

  it('returns a synthetic optimized preview when the free-trial artifact is locked', async () => {
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
        optimizedCvState: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          linkedin: 'https://linkedin.com/in/ana',
          location: 'Sao Paulo',
          summary: 'Resumo real que não deve vazar.',
          experience: [],
          skills: ['SQL', 'Python'],
          education: [],
          certifications: [],
        },
      },
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_123/resume.pdf',
        previewAccess: {
          locked: true,
          blurred: true,
          canViewRealContent: false,
          requiresUpgrade: true,
          requiresRegenerationAfterUnlock: true,
          reason: 'free_trial_locked',
          lockedAt: '2026-04-20T12:00:00.000Z',
          message: 'Seu preview gratuito está bloqueado. Faça upgrade e gere novamente para liberar o currículo real.',
        },
      },
    } as unknown as Awaited<ReturnType<typeof getSession>>)

    vi.mocked(analyzeAtsGeneral)
      .mockResolvedValueOnce({
        success: true,
        result: {
          overallScore: 58,
          structureScore: 70,
          clarityScore: 60,
          impactScore: 40,
          keywordCoverageScore: 55,
          atsReadabilityScore: 65,
          issues: [],
          recommendations: [],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        result: {
          overallScore: 61,
          structureScore: 70,
          clarityScore: 60,
          impactScore: 40,
          keywordCoverageScore: 55,
          atsReadabilityScore: 65,
          issues: [],
          recommendations: [],
        },
      })

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/comparison'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      optimizedCvState: {
        fullName: 'Preview bloqueado',
        summary: 'Esta é uma visualização ilustrativa. O currículo real gerado no free trial não fica disponível para leitura ou download.',
      },
      previewLock: {
        locked: true,
        blurred: true,
        reason: 'free_trial_locked',
        requiresUpgrade: true,
        requiresPaidRegeneration: true,
      },
    })
  })
})
