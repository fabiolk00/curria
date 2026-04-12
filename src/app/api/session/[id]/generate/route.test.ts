import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { dispatchTool } from '@/lib/agent/tools'
import { getSession } from '@/lib/db/sessions'

import { POST } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/agent/tools', () => ({
  dispatchTool: vi.fn(),
}))

function buildAppUser(id: string) {
  return {
    id,
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    authIdentity: {
      id: `identity_${id}`,
      userId: id,
      provider: 'clerk' as const,
      providerSubject: `clerk_${id}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    creditAccount: {
      id: `cred_${id}`,
      userId: id,
      creditsRemaining: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }
}

function buildSession() {
  return {
    id: 'sess_123',
    userId: 'usr_123',
    phase: 'dialog' as const,
    stateVersion: 1,
    cvState: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Backend engineer',
      experience: [],
      skills: ['TypeScript'],
      education: [],
    },
    agentState: {
      parseStatus: 'parsed' as const,
      rewriteHistory: {},
    },
    generatedOutput: { status: 'idle' as const },
    creditsUsed: 1,
    messageCount: 2,
    creditConsumed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('generate route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dispatches base generation', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(dispatchTool).mockResolvedValue(JSON.stringify({
      success: true,
      docxUrl: 'https://example.com/docx',
      pdfUrl: 'https://example.com/pdf',
      creditsUsed: 1,
      resumeGenerationId: 'gen_123',
    }))

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/generate', {
        method: 'POST',
        body: JSON.stringify({ scope: 'base' }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      scope: 'base',
      targetId: undefined,
      creditsUsed: 1,
      generationType: 'ATS_ENHANCEMENT',
      resumeGenerationId: 'gen_123',
    })
    expect(dispatchTool).toHaveBeenCalledWith('generate_file', {
      cv_state: expect.objectContaining({ summary: 'Backend engineer' }),
      target_id: undefined,
      idempotency_key: undefined,
    }, expect.objectContaining({ id: 'sess_123' }))
  })

  it('dispatches target generation', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(dispatchTool).mockResolvedValue(JSON.stringify({
      success: true,
      docxUrl: 'https://example.com/docx',
      pdfUrl: 'https://example.com/pdf',
      creditsUsed: 1,
      resumeGenerationId: 'gen_target_123',
    }))

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/generate', {
        method: 'POST',
        body: JSON.stringify({ scope: 'target', targetId: 'target_123' }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      scope: 'target',
      targetId: 'target_123',
      creditsUsed: 1,
      generationType: 'JOB_TARGETING',
      resumeGenerationId: 'gen_target_123',
    })
    expect(dispatchTool).toHaveBeenCalledWith('generate_file', {
      cv_state: expect.objectContaining({ summary: 'Backend engineer' }),
      target_id: 'target_123',
      idempotency_key: undefined,
    }, expect.objectContaining({ id: 'sess_123' }))
  })

  it('blocks target generation until the realism override was explicitly confirmed', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue({
      ...buildSession(),
      agentState: {
        parseStatus: 'parsed' as const,
        rewriteHistory: {},
        sourceResumeText: 'Frontend developer with React and CSS.',
        targetJobDescription: 'Senior DevOps Engineer with Kubernetes, Terraform and AWS.',
        targetFitAssessment: {
          level: 'weak' as const,
          summary: 'The current profile appears weakly aligned with the target role today, with major gaps that resume rewriting alone will not fully solve.',
          reasons: ['Missing or underrepresented skill: Kubernetes'],
          assessedAt: '2026-04-12T12:00:00.000Z',
        },
        gapAnalysis: {
          analyzedAt: '2026-04-12T12:00:00.000Z',
          result: {
            matchScore: 32,
            missingSkills: ['Kubernetes', 'Terraform', 'AWS'],
            weakAreas: ['experience'],
            improvementSuggestions: ['Build infrastructure projects before targeting this level.'],
          },
        },
        phaseMeta: {
          careerFitWarningIssuedAt: '2026-04-12T12:05:00.000Z',
          careerFitWarningTargetJobDescription: 'Senior DevOps Engineer with Kubernetes, Terraform and AWS.',
        },
      },
    } as never)

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/generate', {
        method: 'POST',
        body: JSON.stringify({ scope: 'target', targetId: 'target_123' }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      success: false,
      error: 'A vaga parece um encaixe fraco para o perfil atual. Confirme explicitamente no chat que deseja continuar antes de gerar esta versao.',
      code: 'CAREER_FIT_CONFIRMATION_REQUIRED',
    })
    expect(dispatchTool).not.toHaveBeenCalled()
  })

  it('returns creditsUsed: 0 for an idempotent replay', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(dispatchTool).mockResolvedValue(JSON.stringify({
      success: true,
      docxUrl: null,
      pdfUrl: 'https://example.com/pdf',
      creditsUsed: 0,
      resumeGenerationId: 'gen_existing_123',
    }))

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/generate', {
        method: 'POST',
        body: JSON.stringify({ scope: 'base', clientRequestId: 'req_existing' }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      scope: 'base',
      targetId: undefined,
      creditsUsed: 0,
      generationType: 'ATS_ENHANCEMENT',
      resumeGenerationId: 'gen_existing_123',
    })
    expect(dispatchTool).toHaveBeenCalledWith('generate_file', {
      cv_state: expect.objectContaining({ summary: 'Backend engineer' }),
      target_id: undefined,
      idempotency_key: 'req_existing',
    }, expect.objectContaining({ id: 'sess_123' }))
  })

  it('returns 202 when the same generation request is already in progress', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(dispatchTool).mockResolvedValue(JSON.stringify({
      success: true,
      pdfUrl: null,
      docxUrl: null,
      creditsUsed: 0,
      resumeGenerationId: 'gen_inflight_123',
      inProgress: true,
    }))

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/generate', {
        method: 'POST',
        body: JSON.stringify({ scope: 'base', clientRequestId: 'req_inflight' }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({
      success: true,
      inProgress: true,
      scope: 'base',
      targetId: undefined,
      creditsUsed: 0,
      generationType: 'ATS_ENHANCEMENT',
      resumeGenerationId: 'gen_inflight_123',
    })
  })

  it('propagates structured generation failures', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(dispatchTool).mockResolvedValue(JSON.stringify({
      success: false,
      code: 'GENERATION_ERROR',
      error: 'File generation failed.',
    }))

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/generate', {
        method: 'POST',
        body: JSON.stringify({ scope: 'base' }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      code: 'GENERATION_ERROR',
      error: 'File generation failed.',
    })
  })

  it('propagates structured validation failures', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(dispatchTool).mockResolvedValue(JSON.stringify({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'summary is required.',
    }))

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/generate', {
        method: 'POST',
        body: JSON.stringify({ scope: 'base' }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'summary is required.',
    })
  })
})
