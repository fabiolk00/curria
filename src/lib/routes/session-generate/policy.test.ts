import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listActiveJobsForUser } from '@/lib/jobs/repository'

import { evaluateSessionGeneratePolicy } from './policy'
import { buildActiveExportConflictBody } from './outcome-builders'
import { isBillingReconciliationPending } from './policy'

vi.mock('@/lib/jobs/repository', () => ({
  listActiveJobsForUser: vi.fn(),
}))

describe('session-generate policy helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listActiveJobsForUser).mockResolvedValue([])
  })

  it('detects reconciliation pending for failed release-credit jobs', () => {
    expect(isBillingReconciliationPending({
      jobId: 'job_1',
      userId: 'usr_1',
      idempotencyKey: 'key',
      type: 'artifact_generation',
      status: 'failed',
      stage: 'release_credit',
      dispatchInputRef: {
        kind: 'session_cv_state',
        sessionId: 'sess_1',
        snapshotSource: 'base',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })).toBe(true)
  })

  it('returns the current export conflict payload', () => {
    expect(buildActiveExportConflictBody({
      jobId: 'job_1',
      userId: 'usr_1',
      idempotencyKey: 'key',
      type: 'artifact_generation',
      status: 'running',
      stage: 'processing',
      dispatchInputRef: {
        kind: 'session_cv_state',
        sessionId: 'sess_1',
        snapshotSource: 'base',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })).toEqual({
      success: false,
      code: 'EXPORT_ALREADY_PROCESSING',
      error: 'You already have an export in progress. Aguarde a conclusão antes de iniciar outra exportação.',
      jobId: 'job_1',
      billingStage: 'processing',
    })
  })

  it('ignores unrelated active exports from other sessions', async () => {
    vi.mocked(listActiveJobsForUser).mockResolvedValue([
      {
        jobId: 'job_other_session',
        userId: 'usr_1',
        sessionId: 'sess_other',
        idempotencyKey: 'artifact:other',
        type: 'artifact_generation',
        status: 'running',
        stage: 'rendering',
        dispatchInputRef: {
          kind: 'session_cv_state',
          sessionId: 'sess_other',
          snapshotSource: 'base',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])

    await expect(evaluateSessionGeneratePolicy({
      scope: 'base',
      session: {
        id: 'sess_1',
        agentState: {},
      } as never,
      appUser: { id: 'usr_1' } as never,
      target: null,
      primaryIdempotencyKey: 'artifact:sess_1:base',
    } as never)).resolves.toEqual({ kind: 'allow' })
  })

  it('blocks active exports that belong to the same session scope', async () => {
    vi.mocked(listActiveJobsForUser).mockResolvedValue([
      {
        jobId: 'job_same_session',
        userId: 'usr_1',
        sessionId: 'sess_1',
        idempotencyKey: 'artifact:sess_1:older',
        type: 'artifact_generation',
        status: 'running',
        stage: 'rendering',
        dispatchInputRef: {
          kind: 'session_cv_state',
          sessionId: 'sess_1',
          snapshotSource: 'base',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])

    await expect(evaluateSessionGeneratePolicy({
      scope: 'base',
      session: {
        id: 'sess_1',
        agentState: {},
      } as never,
      appUser: { id: 'usr_1' } as never,
      target: null,
      primaryIdempotencyKey: 'artifact:sess_1:base',
    } as never)).resolves.toEqual({
      kind: 'blocked_active_export',
      conflictingJob: expect.objectContaining({
        jobId: 'job_same_session',
      }),
    })
  })
})
