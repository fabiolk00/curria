import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockClaimJob,
  mockCompleteJob,
  mockFailJob,
  mockProcessAtsEnhancementJob,
  mockProcessJobTargetingJob,
  mockProcessArtifactGenerationJob,
  mockLogInfo,
  mockLogWarn,
  mockLogError,
} = vi.hoisted(() => ({
  mockClaimJob: vi.fn(),
  mockCompleteJob: vi.fn(),
  mockFailJob: vi.fn(),
  mockProcessAtsEnhancementJob: vi.fn(),
  mockProcessJobTargetingJob: vi.fn(),
  mockProcessArtifactGenerationJob: vi.fn(),
  mockLogInfo: vi.fn(),
  mockLogWarn: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/jobs/repository', () => ({
  claimJob: mockClaimJob,
  completeJob: mockCompleteJob,
  failJob: mockFailJob,
}))

vi.mock('./processors/ats-enhancement', () => ({
  processAtsEnhancementJob: mockProcessAtsEnhancementJob,
}))

vi.mock('./processors/job-targeting', () => ({
  processJobTargetingJob: mockProcessJobTargetingJob,
}))

vi.mock('./processors/artifact-generation', () => ({
  processArtifactGenerationJob: mockProcessArtifactGenerationJob,
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logInfo: mockLogInfo,
  logWarn: mockLogWarn,
  logError: mockLogError,
}))

import { startDurableJobProcessing } from './runtime'

function buildJob(overrides: Record<string, unknown> = {}) {
  return {
    jobId: 'job_123',
    userId: 'usr_123',
    sessionId: 'sess_123',
    idempotencyKey: 'job-key-123',
    type: 'artifact_generation',
    status: 'running',
    stage: 'processing',
    dispatchInputRef: {
      kind: 'session_cv_state',
      sessionId: 'sess_123',
      snapshotSource: 'optimized',
    },
    claimedAt: '2026-04-16T10:00:30.000Z',
    startedAt: '2026-04-16T10:00:30.000Z',
    createdAt: '2026-04-16T10:00:00.000Z',
    updatedAt: '2026-04-16T10:00:30.000Z',
    ...overrides,
  } as any
}

async function flushBackgroundWork() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('startDurableJobProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCompleteJob.mockResolvedValue(undefined)
    mockFailJob.mockResolvedValue(undefined)
  })

  it('returns existing completed jobs without dispatching work when no new owner was claimed', async () => {
    const completedJob = buildJob({
      status: 'completed',
      claimedAt: undefined,
      startedAt: undefined,
      completedAt: '2026-04-16T10:05:00.000Z',
      terminalResultRef: {
        kind: 'resume_generation',
        resumeGenerationId: 'gen_123',
        sessionId: 'sess_123',
        versionNumber: 2,
        snapshotSource: 'generated',
      },
    })
    mockClaimJob.mockResolvedValue(completedJob)

    const result = await startDurableJobProcessing({
      jobId: 'job_123',
      userId: 'usr_123',
    })

    await flushBackgroundWork()

    expect(result).toEqual(completedJob)
    expect(mockProcessArtifactGenerationJob).not.toHaveBeenCalled()
    expect(mockProcessAtsEnhancementJob).not.toHaveBeenCalled()
    expect(mockProcessJobTargetingJob).not.toHaveBeenCalled()
  })

  it('dispatches stale reclaimed artifact_generation jobs and fences completion by ownerClaimedAt', async () => {
    const reclaimedJob = buildJob({
      type: 'artifact_generation',
      claimedAt: '2026-04-16T09:50:30.000Z',
      startedAt: '2026-04-16T09:50:30.000Z',
      updatedAt: '2026-04-16T10:00:30.000Z',
    })
    mockClaimJob.mockResolvedValue(reclaimedJob)
    mockProcessArtifactGenerationJob.mockResolvedValue({
      ok: true,
      stage: 'completed',
      resultRef: {
        kind: 'resume_generation',
        resumeGenerationId: 'gen_123',
        sessionId: 'sess_123',
        versionNumber: 4,
        snapshotSource: 'generated',
      },
    })

    const result = await startDurableJobProcessing({
      jobId: 'job_123',
      userId: 'usr_123',
    })

    await flushBackgroundWork()

    expect(result).toEqual(reclaimedJob)
    expect(mockProcessArtifactGenerationJob).toHaveBeenCalledWith(reclaimedJob)
    expect(mockCompleteJob).toHaveBeenCalledWith({
      jobId: 'job_123',
      userId: 'usr_123',
      ownerClaimedAt: '2026-04-16T09:50:30.000Z',
      stage: 'completed',
      progress: undefined,
      resultRef: {
        kind: 'resume_generation',
        resumeGenerationId: 'gen_123',
        sessionId: 'sess_123',
        versionNumber: 4,
        snapshotSource: 'generated',
      },
    })
  })

  it('persists processor failures with owner-fenced failJob writes for job_targeting', async () => {
    const claimedJob = buildJob({
      type: 'job_targeting',
    })
    mockClaimJob.mockResolvedValue(claimedJob)
    mockProcessJobTargetingJob.mockResolvedValue({
      ok: false,
      stage: 'persist_version',
      errorRef: {
        kind: 'job_error',
        code: 'JOB_TARGETING_FAILED',
        message: 'Targeting rewrite failed.',
        retryable: false,
      },
    })

    await startDurableJobProcessing({
      jobId: 'job_123',
      userId: 'usr_123',
    })

    await flushBackgroundWork()

    expect(mockProcessJobTargetingJob).toHaveBeenCalledWith(claimedJob)
    expect(mockFailJob).toHaveBeenCalledWith({
      jobId: 'job_123',
      userId: 'usr_123',
      ownerClaimedAt: '2026-04-16T10:00:30.000Z',
      stage: 'persist_version',
      errorRef: {
        kind: 'job_error',
        code: 'JOB_TARGETING_FAILED',
        message: 'Targeting rewrite failed.',
        retryable: false,
      },
    })
    expect(mockLogWarn).toHaveBeenCalledWith(
      'jobs.runtime.processing_failed',
      expect.objectContaining({
        jobId: 'job_123',
        type: 'job_targeting',
        stage: 'persist_version',
      }),
    )
  })

  it('maps thrown ATS processor errors to UNEXPECTED_PROCESSOR_ERROR and fails the job', async () => {
    const claimedJob = buildJob({
      type: 'ats_enhancement',
    })
    mockClaimJob.mockResolvedValue(claimedJob)
    mockProcessAtsEnhancementJob.mockRejectedValue(new Error('processor exploded'))

    await startDurableJobProcessing({
      jobId: 'job_123',
      userId: 'usr_123',
    })

    await flushBackgroundWork()

    expect(mockFailJob).toHaveBeenCalledWith({
      jobId: 'job_123',
      userId: 'usr_123',
      ownerClaimedAt: '2026-04-16T10:00:30.000Z',
      stage: 'processing',
      errorRef: {
        kind: 'job_error',
        code: 'UNEXPECTED_PROCESSOR_ERROR',
        message: 'processor exploded',
        retryable: true,
      },
    })
    expect(mockLogError).toHaveBeenCalledWith(
      'jobs.runtime.processing_threw',
      expect.objectContaining({
        jobId: 'job_123',
        type: 'ats_enhancement',
        errorCode: 'UNEXPECTED_PROCESSOR_ERROR',
      }),
    )
  })
})
