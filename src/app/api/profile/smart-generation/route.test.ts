import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'
import { runAtsEnhancementPipeline } from '@/lib/agent/ats-enhancement-pipeline'
import { runJobTargetingPipeline } from '@/lib/agent/job-targeting-pipeline'
import { dispatchToolWithContext } from '@/lib/agent/tools'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getLatestCvVersionForScope } from '@/lib/db/cv-versions'
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

vi.mock('@/lib/db/cv-versions', () => ({
  getLatestCvVersionForScope: vi.fn(),
}))

vi.mock('@/lib/agent/ats-enhancement-pipeline', () => ({
  runAtsEnhancementPipeline: vi.fn(),
}))

vi.mock('@/lib/agent/job-targeting-pipeline', () => ({
  runJobTargetingPipeline: vi.fn(),
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
    id: 'sess_generation_123',
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

let latestCvVersionSnapshot = buildCvState()
let latestCvVersionSource = 'ats-enhancement'

describe('POST /api/profile/smart-generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    latestCvVersionSnapshot = buildCvState()
    latestCvVersionSource = 'ats-enhancement'
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
    vi.mocked(dispatchToolWithContext).mockResolvedValue({
      output: {
        success: true,
        pdfUrl: 'https://example.com/resume.pdf',
        creditsUsed: 1,
        resumeGenerationId: 'gen_123',
      },
      outputJson: JSON.stringify({
        success: true,
        pdfUrl: 'https://example.com/resume.pdf',
        creditsUsed: 1,
        resumeGenerationId: 'gen_123',
      }),
    } as never)
    vi.mocked(getLatestCvVersionForScope).mockImplementation(async () => ({
      id: 'ver_123',
      sessionId: 'sess_generation_123',
      snapshot: latestCvVersionSnapshot,
      source: latestCvVersionSource,
      createdAt: new Date(),
    }) as never)
  })

  it('uses ATS enhancement when no target job description is provided', async () => {
    const optimizedCvState = {
      ...buildCvState(),
      summary: 'Resumo otimizado para ATS com foco em BI e SQL.',
    }
    latestCvVersionSnapshot = optimizedCvState
    latestCvVersionSource = 'ats-enhancement'
    vi.mocked(runAtsEnhancementPipeline).mockImplementation(async (session) => {
      session.agentState.optimizedCvState = optimizedCvState
      session.agentState.rewriteStatus = 'completed'

      return {
        success: true,
        optimizedCvState,
      } as never
    })

    const response = await POST(new NextRequest('https://example.com/api/profile/smart-generation', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify(buildCvState()),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      sessionId: 'sess_generation_123',
      creditsUsed: 1,
      resumeGenerationId: 'gen_123',
      generationType: 'ATS_ENHANCEMENT',
      originalCvState: buildCvState(),
      optimizedCvState,
    })
    expect(runAtsEnhancementPipeline).toHaveBeenCalledWith(expect.objectContaining({
      id: 'sess_generation_123',
      cvState: expect.objectContaining({
        fullName: 'Ana Silva',
        summary: 'Analista de dados com foco em BI e melhoria continua.',
      }),
      agentState: expect.objectContaining({
        workflowMode: 'ats_enhancement',
        parseStatus: 'parsed',
      }),
    }))
    expect(runJobTargetingPipeline).not.toHaveBeenCalled()
    expect(applyToolPatchWithVersion).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_generation_123' }),
      expect.objectContaining({
        agentState: expect.objectContaining({
          workflowMode: 'ats_enhancement',
          targetJobDescription: undefined,
        }),
      }),
      'manual',
    )
    expect(dispatchToolWithContext).toHaveBeenCalledWith(
      'generate_file',
      expect.objectContaining({
        cv_state: optimizedCvState,
        idempotency_key: 'profile-ats:sess_generation_123',
      }),
      expect.objectContaining({
        id: 'sess_generation_123',
        agentState: expect.objectContaining({
          optimizedCvState,
          rewriteStatus: 'completed',
        }),
      }),
    )
  })

  it('uses job targeting when a target job description is present', async () => {
    latestCvVersionSnapshot = {
      ...buildCvState(),
      summary: 'Analista de dados orientada a produto e indicadores para a vaga alvo.',
    }
    latestCvVersionSource = 'job-targeting'
    vi.mocked(runJobTargetingPipeline).mockImplementation(async (session) => {
      session.agentState.optimizedCvState = latestCvVersionSnapshot

      return {
        success: true,
        optimizedCvState: latestCvVersionSnapshot,
      } as never
    })

    const response = await POST(new NextRequest('https://example.com/api/profile/smart-generation', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify({
        ...buildCvState(),
        targetJobDescription: 'Vaga para analista de dados senior com foco em produto e SQL.',
      }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      sessionId: 'sess_generation_123',
      creditsUsed: 1,
      resumeGenerationId: 'gen_123',
      generationType: 'JOB_TARGETING',
      originalCvState: buildCvState(),
      optimizedCvState: {
        ...buildCvState(),
        summary: 'Analista de dados orientada a produto e indicadores para a vaga alvo.',
      },
    })
    expect(runJobTargetingPipeline).toHaveBeenCalledWith(expect.objectContaining({
      id: 'sess_generation_123',
      agentState: expect.objectContaining({
        workflowMode: 'job_targeting',
        targetJobDescription: 'Vaga para analista de dados senior com foco em produto e SQL.',
      }),
    }))
    expect(runAtsEnhancementPipeline).not.toHaveBeenCalled()
    expect(dispatchToolWithContext).toHaveBeenCalledWith(
      'generate_file',
      expect.objectContaining({
        idempotency_key: 'profile-target:sess_generation_123',
      }),
      expect.objectContaining({ id: 'sess_generation_123' }),
    )
  })

  it('keeps ATS readiness validation before starting any generation mode', async () => {
    const response = await POST(new NextRequest('https://example.com/api/profile/smart-generation', {
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
        targetJobDescription: 'Vaga alvo',
      }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Complete seu currículo para adaptar sua versão para a vaga.',
      reasons: expect.any(Array),
      missingItems: expect.any(Array),
    })
    expect(createSession).not.toHaveBeenCalled()
    expect(runAtsEnhancementPipeline).not.toHaveBeenCalled()
    expect(runJobTargetingPipeline).not.toHaveBeenCalled()
  })

  it('still blocks ATS enhancement before generation when summary or experience is missing', async () => {
    const response = await POST(new NextRequest('https://example.com/api/profile/smart-generation', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify({
        ...buildCvState(),
        summary: '',
        experience: [],
      }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Complete seu currículo para gerar uma versão ATS.',
      reasons: expect.arrayContaining([
        expect.stringContaining('Resumo profissional'),
        expect.stringContaining('Experiência'),
      ]),
      missingItems: expect.arrayContaining([
        expect.stringContaining('Resumo profissional'),
        expect.stringContaining('Experiência'),
      ]),
    })
    expect(createSession).not.toHaveBeenCalled()
    expect(runAtsEnhancementPipeline).not.toHaveBeenCalled()
  })

  it('returns structured rewrite validation details when job targeting fails validation', async () => {
    vi.mocked(runJobTargetingPipeline).mockResolvedValue({
      success: false,
      validation: {
        valid: false,
        issues: [{
          severity: 'high',
          section: 'summary',
          message: 'O resumo otimizado menciona skills sem alinhamento com a experiência reescrita.',
        }],
      },
      error: 'Job targeting rewrite validation failed.',
    } as never)
    vi.mocked(createSession).mockResolvedValue({
      ...buildSession(),
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
        targetingPlan: {
          targetRole: 'Vaga Alvo',
          targetRoleConfidence: 'low',
          focusKeywords: [],
          mustEmphasize: [],
          shouldDeemphasize: [],
          missingButCannotInvent: [],
          sectionStrategy: {
            summary: [],
            experience: [],
            skills: [],
            education: [],
            certifications: [],
          },
        },
      },
    } as never)

    const response = await POST(new NextRequest('https://example.com/api/profile/smart-generation', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify({
        ...buildCvState(),
        targetJobDescription: 'Vaga para analista de dados senior com foco em produto e SQL.',
      }),
    }))

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      error: 'Job targeting rewrite validation failed.',
      sessionId: 'sess_generation_123',
      workflowMode: 'job_targeting',
      rewriteValidation: {
        valid: false,
        issues: [{
          severity: 'high',
          section: 'summary',
          message: 'O resumo otimizado menciona skills sem alinhamento com a experiência reescrita.',
        }],
      },
      targetRole: 'Vaga Alvo',
      targetRoleConfidence: 'low',
    })
    expect(dispatchToolWithContext).not.toHaveBeenCalled()
  })

  it('reuses the pipeline-updated session when dispatching generation and validation responses', async () => {
    const optimizedCvState = {
      ...buildCvState(),
      summary: 'Resumo final otimizado para ATS com contexto atualizado.',
    }
    latestCvVersionSnapshot = optimizedCvState
    latestCvVersionSource = 'ats-enhancement'

    vi.mocked(runAtsEnhancementPipeline).mockImplementation(async (session) => {
      session.agentState.optimizedCvState = optimizedCvState
      session.agentState.rewriteStatus = 'completed'

      return {
        success: true,
        optimizedCvState,
      } as never
    })

    const successResponse = await POST(new NextRequest('https://example.com/api/profile/smart-generation', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify(buildCvState()),
    }))

    expect(successResponse.status).toBe(200)
    expect(dispatchToolWithContext).toHaveBeenCalledWith(
      'generate_file',
      expect.objectContaining({
        cv_state: optimizedCvState,
        idempotency_key: 'profile-ats:sess_generation_123',
      }),
      expect.objectContaining({
        id: 'sess_generation_123',
        agentState: expect.objectContaining({
          optimizedCvState,
          rewriteStatus: 'completed',
        }),
      }),
    )

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
    vi.mocked(dispatchToolWithContext).mockResolvedValue({
      output: {
        success: true,
        pdfUrl: 'https://example.com/resume.pdf',
        creditsUsed: 1,
        resumeGenerationId: 'gen_123',
      },
      outputJson: JSON.stringify({
        success: true,
        pdfUrl: 'https://example.com/resume.pdf',
        creditsUsed: 1,
        resumeGenerationId: 'gen_123',
      }),
    } as never)
    vi.mocked(runJobTargetingPipeline).mockImplementation(async (session) => {
      session.agentState.targetingPlan = {
        targetRole: 'Vaga Alvo',
        targetRoleConfidence: 'low',
        focusKeywords: [],
        mustEmphasize: [],
        shouldDeemphasize: [],
        missingButCannotInvent: [],
        sectionStrategy: {
          summary: [],
          experience: [],
          skills: [],
          education: [],
          certifications: [],
        },
      }

      return {
        success: false,
        validation: {
          valid: false,
          issues: [{
            severity: 'high',
            section: 'summary',
            message: 'O resumo otimizado menciona skills sem alinhamento com a experiÃªncia reescrita.',
          }],
        },
        error: 'Job targeting rewrite validation failed.',
      } as never
    })

    const validationResponse = await POST(new NextRequest('https://example.com/api/profile/smart-generation', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify({
        ...buildCvState(),
        targetJobDescription: 'Vaga para analista de dados senior com foco em produto e SQL.',
      }),
    }))

    expect(validationResponse.status).toBe(422)
    expect(await validationResponse.json()).toEqual(expect.objectContaining({
      targetRole: 'Vaga Alvo',
      targetRoleConfidence: 'low',
    }))
  })

  it('rejects cross-origin smart generation requests', async () => {
    const response = await POST(new NextRequest('https://example.com/api/profile/smart-generation', {
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

  it('returns a synthetic optimized preview when free-trial generation is locked', async () => {
    const optimizedCvState = {
      ...buildCvState(),
      summary: 'Resumo real que não deve vazar.',
    }
    latestCvVersionSnapshot = optimizedCvState
    latestCvVersionSource = 'ats-enhancement'

    vi.mocked(runAtsEnhancementPipeline).mockImplementation(async (session) => {
      session.agentState.optimizedCvState = optimizedCvState
      session.agentState.rewriteStatus = 'completed'

      return {
        success: true,
        optimizedCvState,
      } as never
    })
    vi.mocked(dispatchToolWithContext).mockResolvedValue({
      output: {
        success: true,
        pdfUrl: '/api/file/sess_generation_123/locked-preview',
        creditsUsed: 1,
        resumeGenerationId: 'gen_123',
      },
      outputJson: JSON.stringify({
        success: true,
        pdfUrl: '/api/file/sess_generation_123/locked-preview',
        creditsUsed: 1,
        resumeGenerationId: 'gen_123',
      }),
      persistedPatch: {
        generatedOutput: {
          status: 'ready',
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
      },
    } as never)

    const response = await POST(new NextRequest('https://example.com/api/profile/smart-generation', {
      method: 'POST',
      headers: buildTrustedHeaders(),
      body: JSON.stringify(buildCvState()),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      sessionId: 'sess_generation_123',
      creditsUsed: 1,
      resumeGenerationId: 'gen_123',
      generationType: 'ATS_ENHANCEMENT',
      originalCvState: buildCvState(),
      optimizedCvState: expect.objectContaining({
        fullName: 'Preview bloqueado',
      }),
      previewLock: {
        locked: true,
        blurred: true,
        reason: 'free_trial_locked',
        requiresUpgrade: true,
        requiresPaidRegeneration: true,
        message: 'Seu preview gratuito está bloqueado. Faça upgrade e gere novamente para liberar o currículo real.',
      },
    })
  })

  it('preserves typed generate_file handoff failures instead of flattening them to generic 500s', async () => {
    const optimizedCvState = {
      ...buildCvState(),
      summary: 'Resumo otimizado para ATS com contexto atualizado.',
    }
    latestCvVersionSnapshot = optimizedCvState
    latestCvVersionSource = 'ats-enhancement'

    vi.mocked(runAtsEnhancementPipeline).mockImplementation(async (session) => {
      session.agentState.optimizedCvState = optimizedCvState
      session.agentState.rewriteStatus = 'completed'

      return {
        success: true,
        optimizedCvState,
      } as never
    })
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

    const response = await POST(new NextRequest('https://example.com/api/profile/smart-generation', {
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
