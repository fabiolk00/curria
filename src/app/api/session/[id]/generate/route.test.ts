import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import {
  applyGeneratedOutputPatch,
  getSession,
} from '@/lib/db/sessions'
import {
  getResumeTargetForSession,
  updateResumeTargetGeneratedOutput,
} from '@/lib/db/resume-targets'
import { createJob } from '@/lib/jobs/repository'
import { startDurableJobProcessing } from '@/lib/jobs/runtime'
import { logInfo, logWarn } from '@/lib/observability/structured-log'

import { POST } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  applyGeneratedOutputPatch: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('@/lib/db/resume-targets', () => ({
  getResumeTargetForSession: vi.fn(),
  updateResumeTargetGeneratedOutput: vi.fn(),
}))

vi.mock('@/lib/jobs/repository', () => ({
  createJob: vi.fn(),
}))

vi.mock('@/lib/jobs/runtime', () => ({
  startDurableJobProcessing: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  serializeError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
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

function buildTarget() {
  return {
    id: 'target_123',
    sessionId: 'sess_123',
    targetJobDescription: 'Senior Backend Engineer',
    derivedCvState: {
      ...buildSession().cvState,
      summary: 'Targeted backend engineer',
    },
    generatedOutput: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function buildJobSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    jobId: 'job_123',
    userId: 'usr_123',
    sessionId: 'sess_123',
    idempotencyKey: 'session-generate:sess_123:base:abc',
    type: 'artifact_generation' as const,
    status: 'queued' as const,
    stage: 'queued',
    dispatchInputRef: {
      kind: 'session_cv_state' as const,
      sessionId: 'sess_123',
      snapshotSource: 'base' as const,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function buildTrustedHeaders() {
  return {
    'content-type': 'application/json',
    origin: 'https://example.com',
  }
}

describe('generate route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession() as never)
    vi.mocked(getResumeTargetForSession).mockResolvedValue(buildTarget() as never)
    vi.mocked(applyGeneratedOutputPatch).mockResolvedValue(undefined)
    vi.mocked(updateResumeTargetGeneratedOutput).mockResolvedValue(undefined)
  })

  it('dispatches base generation durably and returns 202', async () => {
    vi.mocked(createJob).mockResolvedValue({
      wasCreated: true,
      job: buildJobSnapshot(),
    } as never)
    vi.mocked(startDurableJobProcessing).mockResolvedValue(buildJobSnapshot({
      status: 'running',
      stage: 'processing',
      claimedAt: '2026-04-16T10:00:30.000Z',
      startedAt: '2026-04-16T10:00:30.000Z',
    }) as never)

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/generate', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({ scope: 'base' }),
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
      jobId: 'job_123',
    })
    expect(createJob).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'sess_123',
      resumeTargetId: undefined,
      type: 'artifact_generation',
      dispatchInputRef: {
        kind: 'session_cv_state',
        sessionId: 'sess_123',
        snapshotSource: 'base',
      },
    }))
    expect(startDurableJobProcessing).toHaveBeenCalledWith({
      jobId: 'job_123',
      userId: 'usr_123',
    })
    expect(applyGeneratedOutputPatch).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess_123' }),
      { status: 'generating', error: undefined },
    )
    expect(logInfo).toHaveBeenCalledWith(
      'api.session.generate.in_progress',
      expect.objectContaining({
        sessionId: 'sess_123',
        scope: 'base',
        success: true,
      }),
    )
  })

  it('dispatches target generation durably and keeps target generated output scoped to the target', async () => {
    vi.mocked(createJob).mockResolvedValue({
      wasCreated: true,
      job: buildJobSnapshot({
        resumeTargetId: 'target_123',
        dispatchInputRef: {
          kind: 'resume_target_cv_state',
          sessionId: 'sess_123',
          resumeTargetId: 'target_123',
          snapshotSource: 'target_derived',
        },
      }),
    } as never)
    vi.mocked(startDurableJobProcessing).mockResolvedValue(buildJobSnapshot({
      status: 'running',
      resumeTargetId: 'target_123',
      stage: 'processing',
      dispatchInputRef: {
        kind: 'resume_target_cv_state',
        sessionId: 'sess_123',
        resumeTargetId: 'target_123',
        snapshotSource: 'target_derived',
      },
      claimedAt: '2026-04-16T10:00:30.000Z',
      startedAt: '2026-04-16T10:00:30.000Z',
    }) as never)

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/generate', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({ scope: 'target', targetId: 'target_123' }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({
      success: true,
      inProgress: true,
      scope: 'target',
      targetId: 'target_123',
      creditsUsed: 0,
      generationType: 'JOB_TARGETING',
      jobId: 'job_123',
    })
    expect(createJob).toHaveBeenCalledWith(expect.objectContaining({
      resumeTargetId: 'target_123',
      dispatchInputRef: {
        kind: 'resume_target_cv_state',
        sessionId: 'sess_123',
        resumeTargetId: 'target_123',
        snapshotSource: 'target_derived',
      },
    }))
    expect(updateResumeTargetGeneratedOutput).toHaveBeenCalledWith(
      'sess_123',
      'target_123',
      { status: 'generating', error: undefined },
    )
    expect(applyGeneratedOutputPatch).not.toHaveBeenCalled()
  })

  it('blocks target generation until the realism override was explicitly confirmed', async () => {
    vi.mocked(getSession).mockResolvedValue({
      ...buildSession(),
      agentState: {
        parseStatus: 'parsed' as const,
        rewriteHistory: {},
        sourceResumeText: 'Frontend developer with React and CSS.',
        targetJobDescription: 'Senior DevOps Engineer with Kubernetes, Terraform and AWS.',
        targetFitAssessment: {
          level: 'weak' as const,
          summary: 'O perfil atual parece pouco alinhado com a vaga-alvo neste momento.',
          reasons: ['Skill ausente ou pouco evidenciada: Kubernetes'],
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
        headers: buildTrustedHeaders(),
        body: JSON.stringify({ scope: 'target', targetId: 'target_123' }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      success: false,
      error: 'A vaga parece um encaixe fraco para o perfil atual. Confirme explicitamente no chat que deseja continuar antes de gerar esta versão.',
      code: 'CAREER_FIT_CONFIRMATION_REQUIRED',
    })
    expect(createJob).not.toHaveBeenCalled()
  })

  it('reuses a completed durable generation and returns the durable result metadata immediately', async () => {
    const completedJob = buildJobSnapshot({
      status: 'completed',
      terminalResultRef: {
        kind: 'resume_generation',
        resumeGenerationId: 'gen_existing_123',
        sessionId: 'sess_123',
        versionNumber: 3,
        snapshotSource: 'generated',
      },
      completedAt: '2026-04-16T10:05:00.000Z',
    })
    vi.mocked(createJob).mockResolvedValue({
      wasCreated: false,
      job: completedJob,
    } as never)
    vi.mocked(startDurableJobProcessing).mockResolvedValue(completedJob as never)

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/generate', {
        method: 'POST',
        headers: buildTrustedHeaders(),
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
      jobId: 'job_123',
      resumeGenerationId: 'gen_existing_123',
    })
    expect(applyGeneratedOutputPatch).not.toHaveBeenCalled()
  })

  it('returns 202 when the same durable generation request is already in progress', async () => {
    const runningJob = buildJobSnapshot({
      status: 'running',
      stage: 'processing',
      claimedAt: '2026-04-16T10:00:30.000Z',
      startedAt: '2026-04-16T10:00:30.000Z',
    })
    vi.mocked(createJob).mockResolvedValue({
      wasCreated: false,
      job: runningJob,
    } as never)
    vi.mocked(startDurableJobProcessing).mockResolvedValue(runningJob as never)

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/generate', {
        method: 'POST',
        headers: buildTrustedHeaders(),
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
      jobId: 'job_123',
    })
  })

  it('surfaces durable generation failures as structured responses', async () => {
    const failedJob = buildJobSnapshot({
      status: 'failed',
      terminalErrorRef: {
        kind: 'resume_generation_failure',
        resumeGenerationId: 'gen_failed_123',
        failureReason: 'File generation failed.',
      },
      completedAt: '2026-04-16T10:05:00.000Z',
    })
    vi.mocked(createJob).mockResolvedValue({
      wasCreated: false,
      job: failedJob,
    } as never)
    vi.mocked(startDurableJobProcessing).mockResolvedValue(failedJob as never)

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/generate', {
        method: 'POST',
        headers: buildTrustedHeaders(),
        body: JSON.stringify({ scope: 'base', clientRequestId: 'req_failed' }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      code: 'GENERATION_ERROR',
      error: 'File generation failed.',
      resumeGenerationId: 'gen_failed_123',
    })
    expect(logWarn).toHaveBeenCalledWith(
      'api.session.generate.job_failed',
      expect.objectContaining({
        sessionId: 'sess_123',
        scope: 'base',
      }),
    )
  })

  it('rejects cross-origin generation requests and logs the trust failure', async () => {
    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/generate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://evil.example',
        },
        body: JSON.stringify({ scope: 'base' }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
    expect(createJob).not.toHaveBeenCalled()
    expect(logWarn).toHaveBeenCalledWith(
      'api.session.generate.untrusted_request',
      expect.objectContaining({
        sessionId: 'sess_123',
        appUserId: 'usr_123',
        trustSignal: 'origin',
        trustReason: 'invalid_origin',
      }),
    )
  })
})
