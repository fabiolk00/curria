import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session } from '@/types/agent'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { createSignedResumeArtifactUrls } from '@/lib/agent/tools/generate-file'
import { getResumeTargetForSession } from '@/lib/db/resume-targets'
import { getSession, updateSession } from '@/lib/db/sessions'
import { logError } from '@/lib/observability/structured-log'

import { GET } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
  updateSession: vi.fn(),
}))

vi.mock('@/lib/db/resume-targets', () => ({
  getResumeTargetForSession: vi.fn(),
}))

vi.mock('@/lib/agent/tools/generate-file', () => ({
  createSignedResumeArtifactUrls: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  serializeError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}))

function buildSession(): Session {
  return {
    id: 'sess_123',
    userId: 'usr_123',
    stateVersion: 1,
    phase: 'generation',
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
      parseStatus: 'parsed',
      rewriteHistory: {},
    },
    generatedOutput: {
      status: 'ready',
      docxPath: 'usr_123/sess_123/resume.docx',
      pdfPath: 'usr_123/sess_123/resume.pdf',
      generatedAt: '2026-03-27T12:00:00.000Z',
    },
    atsScore: undefined,
    creditsUsed: 1,
    messageCount: 5,
    creditConsumed: true,
    createdAt: new Date('2026-03-27T12:00:00.000Z'),
    updatedAt: new Date('2026-03-27T12:10:00.000Z'),
  }
}

describe('GET /api/file/[sessionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getResumeTargetForSession).mockResolvedValue(null)
  })

  it('allows the owner to retrieve fresh signed URLs', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: 'identity_123',
        userId: 'usr_123',
        provider: 'clerk',
        providerSubject: 'user_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: 'cred_usr_123',
        userId: 'usr_123',
        creditsRemaining: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(createSignedResumeArtifactUrls).mockResolvedValue({
      docxUrl: 'https://cdn.example.com/signed/docx',
      pdfUrl: 'https://cdn.example.com/signed/pdf',
    })

    const response = await GET(
      new NextRequest('https://example.com/api/file/sess_123'),
      { params: { sessionId: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      docxUrl: null,
      pdfUrl: 'https://cdn.example.com/signed/pdf',
    })
    expect(getSession).toHaveBeenCalledWith('sess_123', 'usr_123')
    expect(createSignedResumeArtifactUrls).toHaveBeenCalledWith(
      undefined,
      'usr_123/sess_123/resume.pdf',
    )
    expect(updateSession).not.toHaveBeenCalled()
  })

  it('retrieves fresh signed URLs for a selected target variant', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: 'identity_123',
        userId: 'usr_123',
        provider: 'clerk',
        providerSubject: 'user_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: 'cred_usr_123',
        userId: 'usr_123',
        creditsRemaining: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(getResumeTargetForSession).mockResolvedValue({
      id: 'target_123',
      sessionId: 'sess_123',
      targetJobDescription: 'AWS backend role',
      derivedCvState: buildSession().cvState,
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_123/targets/target_123/resume.pdf',
        generatedAt: '2026-03-27T12:30:00.000Z',
      },
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:30:00.000Z'),
    })
    vi.mocked(createSignedResumeArtifactUrls).mockResolvedValue({
      docxUrl: 'https://cdn.example.com/signed/target-docx',
      pdfUrl: 'https://cdn.example.com/signed/target-pdf',
    })

    const response = await GET(
      new NextRequest('https://example.com/api/file/sess_123?targetId=target_123'),
      { params: { sessionId: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      docxUrl: null,
      pdfUrl: 'https://cdn.example.com/signed/target-pdf',
    })
    expect(getResumeTargetForSession).toHaveBeenCalledWith('sess_123', 'target_123')
    expect(createSignedResumeArtifactUrls).toHaveBeenCalledWith(
      undefined,
      'usr_123/sess_123/targets/target_123/resume.pdf',
    )
  })

  it('rejects non-owners through the ownership-aware session lookup', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_other',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: 'identity_456',
        userId: 'usr_other',
        provider: 'clerk',
        providerSubject: 'user_456',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: 'cred_usr_other',
        userId: 'usr_other',
        creditsRemaining: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('https://example.com/api/file/sess_123'),
      { params: { sessionId: 'sess_123' } },
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not found' })
    expect(createSignedResumeArtifactUrls).not.toHaveBeenCalled()
  })

  it('rejects target retrieval when the target does not belong to the owned session', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: 'identity_123',
        userId: 'usr_123',
        provider: 'clerk',
        providerSubject: 'user_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: 'cred_usr_123',
        userId: 'usr_123',
        creditsRemaining: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(getResumeTargetForSession).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('https://example.com/api/file/sess_123?targetId=target_other'),
      { params: { sessionId: 'sess_123' } },
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not found' })
    expect(createSignedResumeArtifactUrls).not.toHaveBeenCalled()
  })

  it('returns empty urls when session artifacts do not exist yet', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: 'identity_123',
        userId: 'usr_123',
        provider: 'clerk',
        providerSubject: 'user_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: 'cred_usr_123',
        userId: 'usr_123',
        creditsRemaining: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    vi.mocked(getSession).mockResolvedValue({
      ...buildSession(),
      generatedOutput: {
        status: 'failed',
        error: 'File generation failed.',
      },
    })

    const response = await GET(
      new NextRequest('https://example.com/api/file/sess_123'),
      { params: { sessionId: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      docxUrl: null,
      pdfUrl: null,
      available: false,
    })
    expect(createSignedResumeArtifactUrls).not.toHaveBeenCalled()
  })

  it('does not serve session downloads when a failed artifact still has a stale pdfPath', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: 'identity_123',
        userId: 'usr_123',
        provider: 'clerk',
        providerSubject: 'user_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: 'cred_usr_123',
        userId: 'usr_123',
        creditsRemaining: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    vi.mocked(getSession).mockResolvedValue({
      ...buildSession(),
      generatedOutput: {
        status: 'failed',
        pdfPath: 'usr_123/sess_123/resume.pdf',
        error: 'No credits available to finalize this generation.',
      },
    })

    const response = await GET(
      new NextRequest('https://example.com/api/file/sess_123'),
      { params: { sessionId: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      docxUrl: null,
      pdfUrl: null,
      available: false,
    })
    expect(createSignedResumeArtifactUrls).not.toHaveBeenCalled()
  })

  it('returns empty urls when target artifacts do not exist yet', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: 'identity_123',
        userId: 'usr_123',
        provider: 'clerk',
        providerSubject: 'user_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: 'cred_usr_123',
        userId: 'usr_123',
        creditsRemaining: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(getResumeTargetForSession).mockResolvedValue({
      id: 'target_123',
      sessionId: 'sess_123',
      targetJobDescription: 'AWS backend role',
      derivedCvState: buildSession().cvState,
      generatedOutput: {
        status: 'failed',
        error: 'File generation failed.',
      },
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:30:00.000Z'),
    })

    const response = await GET(
      new NextRequest('https://example.com/api/file/sess_123?targetId=target_123'),
      { params: { sessionId: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      docxUrl: null,
      pdfUrl: null,
      available: false,
    })
  })

  it('does not persist signed URLs back into session state', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: 'identity_123',
        userId: 'usr_123',
        provider: 'clerk',
        providerSubject: 'user_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: 'cred_usr_123',
        userId: 'usr_123',
        creditsRemaining: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(createSignedResumeArtifactUrls).mockResolvedValue({
      docxUrl: 'https://cdn.example.com/signed/docx',
      pdfUrl: 'https://cdn.example.com/signed/pdf',
    })

    const response = await GET(
      new NextRequest('https://example.com/api/file/sess_123'),
      { params: { sessionId: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(updateSession).not.toHaveBeenCalled()
  })

  it('logs structured context when signed url generation fails', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: 'identity_123',
        userId: 'usr_123',
        provider: 'clerk',
        providerSubject: 'user_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: 'cred_usr_123',
        userId: 'usr_123',
        creditsRemaining: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(createSignedResumeArtifactUrls).mockRejectedValue(new Error('signing failed'))

    const response = await GET(
      new NextRequest('https://example.com/api/file/sess_123'),
      { params: { sessionId: 'sess_123' } },
    )

    expect(response.status).toBe(404)
    expect(logError).toHaveBeenCalledWith('api.file.download_urls_failed', expect.objectContaining({
      requestMethod: 'GET',
      requestPath: '/api/file/sess_123',
      sessionId: 'sess_123',
      appUserId: 'usr_123',
      success: false,
      errorMessage: 'signing failed',
    }))
  })
})
