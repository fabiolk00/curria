import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session } from '@/types/agent'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { createSignedResumeArtifactUrls } from '@/lib/agent/tools/generate-file'
import { getResumeTargetForSession } from '@/lib/db/resume-targets'
import { getSession, updateSession } from '@/lib/db/sessions'
import { listJobsForSession } from '@/lib/jobs/repository'
import { logError, logInfo } from '@/lib/observability/structured-log'

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

vi.mock('@/lib/jobs/repository', () => ({
  listJobsForSession: vi.fn(),
}))

vi.mock('@/lib/agent/tools/generate-file', () => ({
  createSignedResumeArtifactUrls: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
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
    vi.mocked(listJobsForSession).mockResolvedValue([])
  })

  it('returns 401 before any session or storage lookup when unauthenticated', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('https://example.com/api/file/sess_123?targetId=target_123'),
      { params: { sessionId: 'sess_123' } },
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(getSession).not.toHaveBeenCalled()
    expect(getResumeTargetForSession).not.toHaveBeenCalled()
    expect(createSignedResumeArtifactUrls).not.toHaveBeenCalled()
    expect(updateSession).not.toHaveBeenCalled()
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
      available: true,
      generationStatus: 'ready',
      reconciliation: undefined,
    })
    expect(getSession).toHaveBeenCalledWith('sess_123', 'usr_123')
    expect(createSignedResumeArtifactUrls).toHaveBeenCalledWith(
      undefined,
      'usr_123/sess_123/resume.pdf',
    )
    expect(updateSession).not.toHaveBeenCalled()
    expect(logInfo).toHaveBeenCalledWith(
      'api.file.download_urls_ready',
      expect.objectContaining({
        sessionId: 'sess_123',
        type: 'artifact_generation',
        generationStatus: 'ready',
        success: true,
      }),
    )
  })

  it('serves only the locked preview pdf url for free-trial generated artifacts', async () => {
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
        creditsRemaining: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    vi.mocked(getSession).mockResolvedValue({
      ...buildSession(),
      generatedOutput: {
        ...buildSession().generatedOutput,
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
    })

    const response = await GET(
      new NextRequest('https://example.com/api/file/sess_123'),
      { params: { sessionId: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      docxUrl: null,
      pdfUrl: '/api/file/sess_123/locked-preview',
      available: true,
      generationStatus: 'ready',
      reconciliation: undefined,
      previewLock: {
        locked: true,
        blurred: true,
        reason: 'free_trial_locked',
        requiresUpgrade: true,
        requiresPaidRegeneration: true,
        message: 'Seu preview gratuito está bloqueado. Faça upgrade e gere novamente para liberar o currículo real.',
      },
    })
    expect(createSignedResumeArtifactUrls).not.toHaveBeenCalled()
  })

  it('keeps serving the last valid base artifact when a newer ATS rewrite attempt failed validation', async () => {
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
      agentState: {
        ...buildSession().agentState,
        workflowMode: 'ats_enhancement',
        rewriteStatus: 'failed',
        optimizedCvState: undefined,
        atsWorkflowRun: {
          status: 'failed',
          currentStage: 'validation',
          attemptCount: 2,
          retriedSections: ['experience'],
          compactedSections: ['experience'],
          sectionAttempts: { experience: 2 },
          usageTotals: {
            sectionAttempts: 2,
            retriedSections: 1,
            compactedSections: 1,
          },
          lastFailureStage: 'validation',
          lastFailureReason: 'ATS rewrite validation failed.',
          updatedAt: '2026-03-27T12:40:00.000Z',
        },
        rewriteValidation: {
          valid: false,
          issues: [{ severity: 'medium', message: 'Resumo sem suporte factual.', section: 'summary' }],
        },
      },
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_123/resume.pdf',
        generatedAt: '2026-03-27T12:30:00.000Z',
      },
    } as Session)
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
      available: true,
      generationStatus: 'ready',
    })
    expect(createSignedResumeArtifactUrls).toHaveBeenCalledWith(
      undefined,
      'usr_123/sess_123/resume.pdf',
    )
  })

  it('returns the latest artifact job lifecycle summary while still serving a previously ready file', async () => {
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
    vi.mocked(listJobsForSession).mockResolvedValue([
      {
        jobId: 'job_failed_123',
        userId: 'usr_123',
        sessionId: 'sess_123',
        idempotencyKey: 'artifact:sess_123:retry',
        type: 'artifact_generation',
        status: 'failed',
        stage: 'release_credit',
        dispatchInputRef: {
          kind: 'session_cv_state',
          sessionId: 'sess_123',
          snapshotSource: 'base',
        },
        terminalErrorRef: {
          kind: 'resume_generation_failure',
          resumeGenerationId: 'gen_failed_123',
          failureReason: 'Rendering failed for the latest retry.',
        },
        createdAt: '2026-04-17T00:10:00.000Z',
        updatedAt: '2026-04-17T00:11:00.000Z',
        claimedAt: '2026-04-17T00:10:05.000Z',
        startedAt: '2026-04-17T00:10:05.000Z',
        completedAt: '2026-04-17T00:11:00.000Z',
      },
    ] as never)
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
      available: true,
      generationStatus: 'failed',
      jobId: 'job_failed_123',
      stage: 'release_credit',
      errorMessage: 'Rendering failed for the latest retry.',
      reconciliation: {
        required: true,
        status: 'pending',
        reason: 'Rendering failed for the latest retry.',
      },
    })
  })

  it('returns reconciliation detail when the artifact is ready but billing finalize still needs repair', async () => {
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
    vi.mocked(listJobsForSession).mockResolvedValue([
      {
        jobId: 'job_reconcile_123',
        userId: 'usr_123',
        sessionId: 'sess_123',
        idempotencyKey: 'artifact:sess_123:reconcile',
        type: 'artifact_generation',
        status: 'completed',
        stage: 'needs_reconciliation',
        dispatchInputRef: {
          kind: 'session_cv_state',
          sessionId: 'sess_123',
          snapshotSource: 'base',
        },
        createdAt: '2026-04-17T00:10:00.000Z',
        updatedAt: '2026-04-17T00:11:00.000Z',
        completedAt: '2026-04-17T00:11:00.000Z',
      },
    ] as never)
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
      available: true,
      generationStatus: 'ready',
      jobId: 'job_reconcile_123',
      stage: 'needs_reconciliation',
      errorMessage: undefined,
      reconciliation: {
        required: true,
        status: 'pending',
        reason: undefined,
      },
    })
  })

  it('serves the latest valid base artifact for a completed job_targeting rewrite', async () => {
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
      agentState: {
        ...buildSession().agentState,
        workflowMode: 'job_targeting',
        rewriteStatus: 'completed',
        lastRewriteMode: 'job_targeting',
        targetJobDescription: 'Senior Analytics Engineer com foco em dbt e BigQuery.',
        optimizedCvState: {
          ...buildSession().cvState,
          summary: 'Analytics engineer com foco em dbt, SQL e BigQuery.',
          skills: ['TypeScript', 'dbt', 'BigQuery'],
        },
      },
      generatedOutput: {
        status: 'ready',
        pdfPath: 'usr_123/sess_123/resume-targeted.pdf',
        generatedAt: '2026-03-27T12:35:00.000Z',
      },
    } as Session)
    vi.mocked(createSignedResumeArtifactUrls).mockResolvedValue({
      docxUrl: 'https://cdn.example.com/signed/docx',
      pdfUrl: 'https://cdn.example.com/signed/pdf-targeted',
    })

    const response = await GET(
      new NextRequest('https://example.com/api/file/sess_123'),
      { params: { sessionId: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      docxUrl: null,
      pdfUrl: 'https://cdn.example.com/signed/pdf-targeted',
      available: true,
      generationStatus: 'ready',
    })
    expect(createSignedResumeArtifactUrls).toHaveBeenCalledWith(
      undefined,
      'usr_123/sess_123/resume-targeted.pdf',
    )
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
      available: true,
      generationStatus: 'ready',
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
    expect(getResumeTargetForSession).not.toHaveBeenCalled()
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
      generationStatus: 'failed',
      errorMessage: 'File generation failed.',
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
      generationStatus: 'failed',
      errorMessage: 'No credits available to finalize this generation.',
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
      generationStatus: 'failed',
      errorMessage: 'File generation failed.',
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
      type: 'artifact_generation',
      generationStatus: 'ready',
      success: false,
      errorMessage: 'signing failed',
    }))
  })
})
