import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'

import {
  hashOverrideToken,
  tryAcquireOverrideProcessingLock,
} from './override-processing-lock'

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}))

function buildSessionRow(overrides: {
  stateVersion?: number
  validationOverride?: Record<string, unknown>
  overrideProcessing?: Record<string, unknown>
  expiresAt?: string
} = {}) {
  return {
    id: 'sess_123',
    user_id: 'usr_123',
    state_version: overrides.stateVersion ?? 1,
    phase: 'intake',
    cv_state: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Resumo base',
      experience: [],
      skills: ['SQL'],
      education: [],
      certifications: [],
    },
    agent_state: {
      parseStatus: 'parsed',
      rewriteHistory: {},
      blockedTargetedRewriteDraft: {
        id: 'draft_123',
        token: 'override_token_123',
        sessionId: 'sess_123',
        userId: 'usr_123',
        originalCvState: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          summary: 'Resumo base',
          experience: [],
          skills: ['SQL'],
          education: [],
          certifications: [],
        },
        targetJobDescription: 'Vaga Java',
        validationIssues: [{
          severity: 'high',
          section: 'summary',
          issueType: 'low_fit_target_role',
          message: 'Muito distante.',
        }],
        recoverable: true,
        createdAt: '2026-04-27T15:00:00.000Z',
        expiresAt: overrides.expiresAt ?? '2099-04-27T15:20:00.000Z',
        overrideProcessing: overrides.overrideProcessing,
      },
      recoverableValidationBlock: {
        status: 'validation_blocked_recoverable',
        kind: 'pre_rewrite_low_fit_block',
        overrideToken: 'override_token_123',
        modal: {
          title: 'Low fit',
          description: 'Low fit',
          primaryProblem: 'Low fit',
          problemBullets: [],
          reassurance: 'Revisar',
          actions: {
            secondary: {
              label: 'Fechar',
              action: 'close',
            },
            primary: {
              label: 'Gerar mesmo assim (1 crédito)',
              action: 'override_generate',
              creditCost: 1,
            },
          },
        },
        expiresAt: overrides.expiresAt ?? '2099-04-27T15:20:00.000Z',
        overrideProcessing: overrides.overrideProcessing,
      },
      validationOverride: overrides.validationOverride,
    },
    generated_output: { status: 'idle' },
    ats_score: null,
    credits_used: 0,
    message_count: 0,
    credit_consumed: false,
    created_at: '2026-04-27T15:00:00.000Z',
    updated_at: '2026-04-27T15:00:00.000Z',
  }
}

function createSessionsSupabaseHarness(initialRow = buildSessionRow()) {
  let row = structuredClone(initialRow)
  const pendingSelectResolvers: Array<() => void> = []
  let forceParallelSelectBarrier = false

  const maybeSingleSelect = vi.fn(() => {
    if (!forceParallelSelectBarrier) {
      return Promise.resolve({ data: structuredClone(row), error: null })
    }

    return new Promise<{ data: typeof row; error: null }>((resolve) => {
      pendingSelectResolvers.push(() => resolve({ data: structuredClone(row), error: null }))
      if (pendingSelectResolvers.length === 2) {
        const resolvers = [...pendingSelectResolvers]
        pendingSelectResolvers.length = 0
        forceParallelSelectBarrier = false
        resolvers.forEach((resume) => resume())
      }
    })
  })

  const maybeSingleUpdate = vi.fn(() => Promise.resolve({ data: null, error: null }))

  const supabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: maybeSingleSelect,
          })),
        })),
      })),
      update: vi.fn((payload: Record<string, unknown>) => {
        const conditions: Record<string, unknown> = {}

        return {
          eq(column: string, value: unknown) {
            conditions[column] = value
            return this
          },
          select: vi.fn(() => ({
            maybeSingle: vi.fn(() => {
              if (
                conditions.id === row.id
                && conditions.user_id === row.user_id
                && conditions.state_version === row.state_version
              ) {
                row = {
                  ...row,
                  agent_state: structuredClone(payload.agent_state) as typeof row.agent_state,
                  state_version: payload.state_version as number,
                  updated_at: payload.updated_at as string,
                }
                return Promise.resolve({ data: structuredClone(row), error: null })
              }

              return maybeSingleUpdate()
            }),
          })),
        }
      }),
    })),
  }

  return {
    supabase,
    getRow: () => structuredClone(row),
    enableParallelSelectBarrier: () => {
      forceParallelSelectBarrier = true
    },
    maybeSingleUpdate,
  }
}

describe('override processing lock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('acquires the persistent lock and stores processing metadata atomically', async () => {
    const harness = createSessionsSupabaseHarness()
    vi.mocked(getSupabaseAdminClient).mockReturnValue(harness.supabase as never)

    const result = await tryAcquireOverrideProcessingLock({
      sessionId: 'sess_123',
      userId: 'usr_123',
      draftId: 'draft_123',
      overrideToken: 'override_token_123',
      requestId: 'req_123',
      now: new Date('2026-04-27T15:00:00.000Z'),
      lockTtlMs: 5 * 60 * 1000,
      idempotencyKey: 'profile-target-override:sess_123:draft_123',
    })

    expect(result.acquired).toBe(true)
    if (!result.acquired) {
      return
    }

    expect(result.processingState.requestId).toBe('req_123')
    expect(result.processingState.status).toBe('processing')
    expect(result.processingState.overrideTokenHash).toBe(hashOverrideToken('override_token_123'))
    expect(harness.getRow().agent_state.blockedTargetedRewriteDraft.overrideProcessing).toMatchObject({
      requestId: 'req_123',
      status: 'processing',
    })
  })

  it('blocks a second concurrent acquisition across simulated instances and keeps only one winner', async () => {
    const harness = createSessionsSupabaseHarness()
    harness.enableParallelSelectBarrier()
    vi.mocked(getSupabaseAdminClient).mockReturnValue(harness.supabase as never)

    const [first, second] = await Promise.all([
      tryAcquireOverrideProcessingLock({
        sessionId: 'sess_123',
        userId: 'usr_123',
        draftId: 'draft_123',
        overrideToken: 'override_token_123',
        requestId: 'req_first',
        now: new Date('2026-04-27T15:00:00.000Z'),
        lockTtlMs: 5 * 60 * 1000,
        idempotencyKey: 'profile-target-override:sess_123:draft_123',
      }),
      tryAcquireOverrideProcessingLock({
        sessionId: 'sess_123',
        userId: 'usr_123',
        draftId: 'draft_123',
        overrideToken: 'override_token_123',
        requestId: 'req_second',
        now: new Date('2026-04-27T15:00:00.000Z'),
        lockTtlMs: 5 * 60 * 1000,
        idempotencyKey: 'profile-target-override:sess_123:draft_123',
      }),
    ])

    const winners = [first, second].filter((result) => result.acquired)
    const losers = [first, second].filter((result) => !result.acquired)

    expect(winners).toHaveLength(1)
    expect(losers).toHaveLength(1)
    expect(losers[0]).toMatchObject({
      acquired: false,
      reason: 'already_processing',
    })
    const winningResult = winners[0]
    expect(winningResult && winningResult.acquired).toBe(true)
    expect(harness.getRow().agent_state.blockedTargetedRewriteDraft.overrideProcessing?.requestId).toBe(
      winningResult && winningResult.acquired ? winningResult.processingState.requestId : undefined,
    )
  })

  it('reclaims an expired persistent lock', async () => {
    const harness = createSessionsSupabaseHarness(buildSessionRow({
      overrideProcessing: {
        status: 'processing',
        requestId: 'req_old',
        startedAt: '2026-04-27T14:00:00.000Z',
        expiresAt: '2026-04-27T14:05:00.000Z',
        idempotencyKey: 'profile-target-override:sess_123:draft_123',
        overrideTokenHash: 'hash:override_token_123',
      },
    }))
    vi.mocked(getSupabaseAdminClient).mockReturnValue(harness.supabase as never)

    const result = await tryAcquireOverrideProcessingLock({
      sessionId: 'sess_123',
      userId: 'usr_123',
      draftId: 'draft_123',
      overrideToken: 'override_token_123',
      requestId: 'req_new',
      now: new Date('2026-04-27T15:00:00.000Z'),
      lockTtlMs: 5 * 60 * 1000,
      idempotencyKey: 'profile-target-override:sess_123:draft_123',
    })

    expect(result).toMatchObject({
      acquired: true,
      expiredLockReclaimed: true,
      previousRequestId: 'req_old',
      previousExpiresAt: '2026-04-27T14:05:00.000Z',
    })
  })

  it('returns an idempotent completed result when the token already succeeded', async () => {
    const harness = createSessionsSupabaseHarness(buildSessionRow({
      validationOverride: {
        enabled: true,
        overrideTokenHash: hashOverrideToken('override_token_123'),
        cvVersionId: 'ver_123',
        resumeGenerationId: 'gen_123',
      },
    }))
    vi.mocked(getSupabaseAdminClient).mockReturnValue(harness.supabase as never)

    const result = await tryAcquireOverrideProcessingLock({
      sessionId: 'sess_123',
      userId: 'usr_123',
      draftId: 'draft_123',
      overrideToken: 'override_token_123',
      requestId: 'req_123',
      now: new Date('2026-04-27T15:00:00.000Z'),
      lockTtlMs: 5 * 60 * 1000,
      idempotencyKey: 'profile-target-override:sess_123:draft_123',
    })

    expect(result).toEqual({
      acquired: false,
      reason: 'already_completed',
      completedResult: {
        cvVersionId: 'ver_123',
        resumeGenerationId: 'gen_123',
      },
    })
  })
})
