import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { dispatchToolWithContext } from '@/lib/agent/tools'
import { applyToolPatchWithVersion, checkUserQuota, createSession } from '@/lib/db/sessions'
import { runAtsEnhancementPipeline } from '@/lib/agent/ats-enhancement-pipeline'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/agent/tools', () => ({
  dispatchToolWithContext: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  createSession: vi.fn(),
  checkUserQuota: vi.fn(),
  applyToolPatchWithVersion: vi.fn(),
}))

vi.mock('@/lib/agent/ats-enhancement-pipeline', () => ({
  runAtsEnhancementPipeline: vi.fn(),
}))

function buildCvState() {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    linkedin: 'https://linkedin.com/in/ana',
    location: 'Sao Paulo',
    summary: 'Analista de dados com foco em BI e melhoria continua.',
    experience: [{
      title: 'Analista de Dados',
      company: 'Acme',
      location: 'Sao Paulo',
      startDate: '2022',
      endDate: '2024',
      bullets: ['Criei dashboards executivos.', 'Automatizei relatorios.'],
    }],
    skills: ['SQL', 'Power BI', 'ETL', 'Excel'],
    education: [{
      degree: 'Bacharel em Sistemas de Informacao',
      institution: 'USP',
      year: '2020',
    }],
    certifications: [{
      name: 'AWS Cloud Practitioner',
      issuer: 'Amazon',
      year: '2024',
    }],
  }
}

function buildSession() {
  return {
    id: 'sess_ats_123',
    userId: 'usr_123',
    phase: 'intake',
    stateVersion: 1,
    cvState: buildCvState(),
    agentState: {
      parseStatus: 'empty',
      rewriteHistory: {},
    },
    generatedOutput: { status: 'idle' },
    creditsUsed: 0,
    messageCount: 0,
    creditConsumed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function buildTrustedHeaders() {
  return {
    'content-type': 'application/json',
    origin: 'https://example.com',
  }
}

describe('POST /api/profile/ats-enhancement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: 'identity_123',
        userId: 'usr_123',
        provider: 'clerk',
        providerSubject: 'clerk_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: 'cred_123',
        userId: 'usr_123',
        creditsRemaining: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as never)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue(buildSession() as never)
    vi.mocked(runAtsEnhancementPipeline).mockResolvedValue({
      success: true,
      optimizedCvState: {
        ...buildCvState(),
        summary: 'Analista de dados com foco em BI, SQL e automacao orientada a impacto.',
      },
      optimizationSummary: {
        changedSections: ['summary', 'experience', 'skills'],
        notes: ['Strengthened ATS wording'],
      },
      atsAnalysis: {
        result: {
          overallScore: 79,
          structureScore: 80,
          clarityScore: 78,
          impactScore: 76,
          keywordCoverageScore: 79,
          atsReadabilityScore: 82,
          issues: [],
          recommendations: ['Strengthen ATS wording'],
        },
        analyzedAt: '2026-04-14T12:00:00.000Z',
      },
      validation: {
        blocked: false,
        valid: true,
        hardIssues: [],
        softWarnings: [],
        issues: [],
      },
    })
    vi.mocked(dispatchToolWithContext)
      .mockResolvedValueOnce({
        output: {
          success: true,
          pdfUrl: 'https://example.com/resume.pdf',
          creditsUsed: 1,
          resumeGenerationId: 'gen_ats_123',
        },
        outputJson: JSON.stringify({
          success: true,
          pdfUrl: 'https://example.com/resume.pdf',
          creditsUsed: 1,
          resumeGenerationId: 'gen_ats_123',
        }),
      } as never)
  })

  it('creates an ATS enhancement session from the current profile snapshot', async () => {
    const response = await POST(new NextRequest('https://example.com/api/profile/ats-enhancement', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify(buildCvState()),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      sessionId: 'sess_ats_123',
      creditsUsed: 1,
      resumeGenerationId: 'gen_ats_123',
      generationType: 'ATS_ENHANCEMENT',
    })
    expect(applyToolPatchWithVersion).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_ats_123' }),
      expect.objectContaining({
        cvState: expect.objectContaining({ fullName: 'Ana Silva' }),
        agentState: expect.objectContaining({ workflowMode: 'ats_enhancement' }),
      }),
      'manual',
    )
    expect(dispatchToolWithContext).toHaveBeenNthCalledWith(1, 'generate_file', {
      cv_state: expect.objectContaining({
        fullName: 'Ana Silva',
        summary: 'Analista de dados com foco em BI, SQL e automacao orientada a impacto.',
      }),
      idempotency_key: 'profile-ats:sess_ats_123',
    }, expect.objectContaining({ id: 'sess_ats_123' }))
  })

  it('runs the shared ATS enhancement pipeline before generating artifacts', async () => {
    await POST(new NextRequest('https://example.com/api/profile/ats-enhancement', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify(buildCvState()),
    }))

    expect(runAtsEnhancementPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_ats_123' }),
    )
  })

  it('rejects incomplete profiles before creating the ATS version', async () => {
    const response = await POST(new NextRequest('https://example.com/api/profile/ats-enhancement', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify({
        fullName: '',
        email: '',
        phone: '',
        linkedin: '',
        location: '',
        summary: '',
        experience: [],
        skills: ['SQL'],
        education: [],
        certifications: [],
      }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Complete seu currículo para gerar uma versão ATS.',
      reasons: expect.any(Array),
      missingItems: expect.any(Array),
    })
    expect(createSession).not.toHaveBeenCalled()
    expect(dispatchToolWithContext).not.toHaveBeenCalled()
  })

  it('rejects partially filled education entries with user-friendly missing items', async () => {
    const response = await POST(new NextRequest('https://example.com/api/profile/ats-enhancement', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify({
        ...buildCvState(),
        education: [{
          degree: 'Bacharel em Sistemas de Informacao',
          institution: '',
          year: '2023',
        }],
      }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Complete seu currículo para gerar uma versão ATS.',
      reasons: ['Formação 1: adicione a instituição.'],
      missingItems: ['Formação 1: adicione a instituição.'],
    })
    expect(createSession).not.toHaveBeenCalled()
    expect(dispatchToolWithContext).not.toHaveBeenCalled()
  })

  it('rejects profiles that leave required ATS sections empty', async () => {
    const response = await POST(new NextRequest('https://example.com/api/profile/ats-enhancement', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify({
        ...buildCvState(),
        summary: '',
        education: [],
        certifications: [],
      }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Complete seu currículo para gerar uma versão ATS.',
      reasons: [
        'Resumo profissional: escreva um resumo curto com seu posicionamento e seus principais resultados.',
        'Educação: adicione pelo menos uma formação acadêmica.',
      ],
      missingItems: [
        'Resumo profissional: escreva um resumo curto com seu posicionamento e seus principais resultados.',
        'Educação: adicione pelo menos uma formação acadêmica.',
      ],
    })
    expect(createSession).not.toHaveBeenCalled()
    expect(dispatchToolWithContext).not.toHaveBeenCalled()
  })

  it('keeps generating the ATS version when the experience rewrite payload is malformed', async () => {
    vi.mocked(runAtsEnhancementPipeline).mockResolvedValue({
      success: true,
      optimizedCvState: buildCvState(),
      optimizationSummary: {
        changedSections: ['summary', 'skills'],
        notes: ['Fallback kept original experience'],
      },
      atsAnalysis: {
        result: {
          overallScore: 71,
          structureScore: 75,
          clarityScore: 70,
          impactScore: 68,
          keywordCoverageScore: 70,
          atsReadabilityScore: 72,
          issues: [],
          recommendations: [],
        },
        analyzedAt: '2026-04-14T12:00:00.000Z',
      },
      validation: {
        blocked: false,
        valid: true,
        hardIssues: [],
        softWarnings: [],
        issues: [],
      },
    })
    vi.mocked(dispatchToolWithContext).mockReset()
    vi.mocked(dispatchToolWithContext)
      .mockResolvedValueOnce({
        output: {
          success: true,
          pdfUrl: 'https://example.com/resume.pdf',
          creditsUsed: 1,
          resumeGenerationId: 'gen_ats_123',
        },
        outputJson: JSON.stringify({
          success: true,
          pdfUrl: 'https://example.com/resume.pdf',
          creditsUsed: 1,
          resumeGenerationId: 'gen_ats_123',
        }),
      } as never)

    const response = await POST(new NextRequest('https://example.com/api/profile/ats-enhancement', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify(buildCvState()),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      sessionId: 'sess_ats_123',
      creditsUsed: 1,
      resumeGenerationId: 'gen_ats_123',
      generationType: 'ATS_ENHANCEMENT',
    })
    expect(dispatchToolWithContext).toHaveBeenNthCalledWith(1, 'generate_file', {
      cv_state: expect.objectContaining({ fullName: 'Ana Silva' }),
      idempotency_key: 'profile-ats:sess_ats_123',
    }, expect.objectContaining({ id: 'sess_ats_123' }))
  })

  it('rejects cross-origin ATS enhancement requests before creating a session', async () => {
    const response = await POST(new NextRequest('https://example.com/api/profile/ats-enhancement', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example',
      },
      body: JSON.stringify(buildCvState()),
    }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
    expect(createSession).not.toHaveBeenCalled()
    expect(dispatchToolWithContext).not.toHaveBeenCalled()
  })

  it('preserves typed generate_file handoff failures instead of flattening them to generic 500s', async () => {
    vi.mocked(dispatchToolWithContext).mockReset()
    vi.mocked(dispatchToolWithContext).mockResolvedValue({
      output: {
        success: false,
        code: 'PRECONDITION_FAILED',
        error: 'The requested resume snapshot no longer matches the authoritative optimized source for this session.',
      },
      outputJson: JSON.stringify({
        success: false,
        code: 'PRECONDITION_FAILED',
        error: 'The requested resume snapshot no longer matches the authoritative optimized source for this session.',
      }),
      outputFailure: {
        success: false,
        code: 'PRECONDITION_FAILED',
        error: 'The requested resume snapshot no longer matches the authoritative optimized source for this session.',
      },
    } as never)

    const response = await POST(new NextRequest('https://example.com/api/profile/ats-enhancement', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify(buildCvState()),
    }))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'The requested resume snapshot no longer matches the authoritative optimized source for this session.',
      code: 'PRECONDITION_FAILED',
    })
  })
})
