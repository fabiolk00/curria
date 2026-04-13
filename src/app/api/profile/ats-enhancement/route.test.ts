import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { dispatchToolWithContext } from '@/lib/agent/tools'
import { applyToolPatchWithVersion, checkUserQuota, createSession } from '@/lib/db/sessions'

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
    vi.mocked(dispatchToolWithContext)
      .mockResolvedValueOnce({
        output: { success: true },
        outputJson: JSON.stringify({ success: true }),
      } as never)
      .mockResolvedValueOnce({
        output: { success: true },
        outputJson: JSON.stringify({ success: true }),
      } as never)
      .mockResolvedValueOnce({
        output: { success: true },
        outputJson: JSON.stringify({ success: true }),
      } as never)
      .mockResolvedValueOnce({
        output: { success: true, result: { total: 71 } },
        outputJson: JSON.stringify({ success: true, result: { total: 71 } }),
      } as never)
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
      }),
      'manual',
    )
    expect(dispatchToolWithContext).toHaveBeenNthCalledWith(5, 'generate_file', {
      cv_state: expect.objectContaining({ fullName: 'Ana Silva' }),
      idempotency_key: 'profile-ats:sess_ats_123',
    }, expect.objectContaining({ id: 'sess_ats_123' }))
  })

  it('sends PT-BR ATS rewriting guidance into the enhancement flow', async () => {
    await POST(new NextRequest('https://example.com/api/profile/ats-enhancement', {
      method: 'POST',
      body: JSON.stringify(buildCvState()),
    }))

    expect(dispatchToolWithContext).toHaveBeenNthCalledWith(1, 'rewrite_section', expect.objectContaining({
      section: 'summary',
      instructions: expect.stringContaining('Brazilian Portuguese (pt-BR)'),
    }), expect.objectContaining({ id: 'sess_ats_123' }))
    expect(dispatchToolWithContext).toHaveBeenNthCalledWith(2, 'rewrite_section', expect.objectContaining({
      section: 'experience',
      instructions: expect.stringContaining('acao + contexto + resultado'),
    }), expect.objectContaining({ id: 'sess_ats_123' }))
    expect(dispatchToolWithContext).toHaveBeenNthCalledWith(3, 'rewrite_section', expect.objectContaining({
      section: 'skills',
      instructions: expect.stringContaining('habilidades section'),
    }), expect.objectContaining({ id: 'sess_ats_123' }))
    expect(dispatchToolWithContext).toHaveBeenNthCalledWith(3, 'rewrite_section', expect.objectContaining({
      instructions: expect.stringContaining('resumo profissional, habilidades, experiencia profissional, educacao, certificacoes, idiomas'),
    }), expect.objectContaining({ id: 'sess_ats_123' }))
  })

  it('rejects incomplete profiles before creating the ATS version', async () => {
    const response = await POST(new NextRequest('https://example.com/api/profile/ats-enhancement', {
      method: 'POST',
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
      error: 'Complete seu curriculo para gerar uma versao ATS.',
      reasons: expect.any(Array),
      missingItems: expect.any(Array),
    })
    expect(createSession).not.toHaveBeenCalled()
    expect(dispatchToolWithContext).not.toHaveBeenCalled()
  })

  it('rejects partially filled education entries with user-friendly missing items', async () => {
    const response = await POST(new NextRequest('https://example.com/api/profile/ats-enhancement', {
      method: 'POST',
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
      error: 'Complete seu curriculo para gerar uma versao ATS.',
      reasons: ['Formacao 1: adicione a instituicao.'],
      missingItems: ['Formacao 1: adicione a instituicao.'],
    })
    expect(createSession).not.toHaveBeenCalled()
    expect(dispatchToolWithContext).not.toHaveBeenCalled()
  })

  it('rejects profiles that leave required ATS sections empty', async () => {
    const response = await POST(new NextRequest('https://example.com/api/profile/ats-enhancement', {
      method: 'POST',
      body: JSON.stringify({
        ...buildCvState(),
        summary: '',
        education: [],
        certifications: [],
      }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Complete seu curriculo para gerar uma versao ATS.',
      reasons: [
        'Resumo profissional: escreva um resumo curto com seu posicionamento e seus principais resultados.',
        'Educacao: adicione pelo menos uma formacao academica.',
      ],
      missingItems: [
        'Resumo profissional: escreva um resumo curto com seu posicionamento e seus principais resultados.',
        'Educacao: adicione pelo menos uma formacao academica.',
      ],
    })
    expect(createSession).not.toHaveBeenCalled()
    expect(dispatchToolWithContext).not.toHaveBeenCalled()
  })
})
