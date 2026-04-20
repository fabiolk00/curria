import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listCreditReservationsForReconciliation } from '@/lib/db/credit-reservations'
import type { CreditReservation } from '@/lib/db/credit-reservations'
import type { ResumeGenerationType } from '@/types/agent'
import { summarizeBillingAnomalies } from './billing-alerts'

vi.mock('@/lib/db/credit-reservations', () => ({
  listCreditReservationsForReconciliation: vi.fn(),
}))

function buildReservation(input: {
  id: string
  userId: string
  generationIntentKey: string
  status: 'reserved' | 'finalized' | 'released' | 'needs_reconciliation'
  failureReason?: string
  createdAt: string
}): CreditReservation {
  return {
    id: input.id,
    userId: input.userId,
    generationIntentKey: input.generationIntentKey,
    jobId: `job_${input.id}`,
    sessionId: `session_${input.id}`,
    resumeTargetId: undefined,
    resumeGenerationId: undefined,
    type: 'ATS_ENHANCEMENT' as ResumeGenerationType,
    status: input.status,
    creditsReserved: 1,
    failureReason: input.failureReason,
    reservedAt: new Date(input.createdAt),
    finalizedAt: undefined,
    releasedAt: undefined,
    reconciliationStatus: input.status === 'needs_reconciliation' ? 'pending' : 'clean',
    metadata: { source: 'test' },
    createdAt: new Date(input.createdAt),
    updatedAt: new Date(input.createdAt),
  }
}

describe('billing anomaly summaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('surfaces unresolved needs_reconciliation rows older than the configured threshold', async () => {
    vi.mocked(listCreditReservationsForReconciliation).mockResolvedValue([
      buildReservation({
        id: 'reservation_stale',
        userId: 'usr_123',
        generationIntentKey: 'intent_stale',
        status: 'needs_reconciliation',
        failureReason: 'finalize_failed',
        createdAt: '2026-04-20T09:00:00.000Z',
      }),
      buildReservation({
        id: 'reservation_fresh',
        userId: 'usr_123',
        generationIntentKey: 'intent_fresh',
        status: 'needs_reconciliation',
        failureReason: 'finalize_failed',
        createdAt: '2026-04-20T09:55:00.000Z',
      }),
    ])

    const summary = await summarizeBillingAnomalies({
      now: new Date('2026-04-20T10:00:00.000Z'),
      thresholds: {
        staleReconciliationMinutes: 30,
      },
    })

    expect(summary.anomalies).toContainEqual(expect.objectContaining({
      kind: 'stale_reconciliation',
      count: 1,
    }))
    expect(summary.anomalies.find((anomaly) => anomaly.kind === 'stale_reconciliation')?.examples[0])
      .toMatchObject({
        reservationId: 'reservation_stale',
        generationIntentKey: 'intent_stale',
        ageMinutes: 60,
      })
  })

  it('summarizes repeated finalize and release failures into machine-readable counts and examples', async () => {
    vi.mocked(listCreditReservationsForReconciliation).mockResolvedValue([
      buildReservation({
        id: 'reservation_finalize_a',
        userId: 'usr_finalize',
        generationIntentKey: 'intent_finalize_a',
        status: 'needs_reconciliation',
        failureReason: 'finalize_failed_after_render',
        createdAt: '2026-04-20T09:00:00.000Z',
      }),
      buildReservation({
        id: 'reservation_finalize_b',
        userId: 'usr_finalize',
        generationIntentKey: 'intent_finalize_b',
        status: 'needs_reconciliation',
        failureReason: 'finalize_failed_retry',
        createdAt: '2026-04-20T09:05:00.000Z',
      }),
      buildReservation({
        id: 'reservation_release_a',
        userId: 'usr_release',
        generationIntentKey: 'intent_release_a',
        status: 'needs_reconciliation',
        failureReason: 'release_failed_timeout',
        createdAt: '2026-04-20T09:10:00.000Z',
      }),
      buildReservation({
        id: 'reservation_release_b',
        userId: 'usr_release',
        generationIntentKey: 'intent_release_b',
        status: 'needs_reconciliation',
        failureReason: 'release_failed_timeout',
        createdAt: '2026-04-20T09:15:00.000Z',
      }),
    ])

    const summary = await summarizeBillingAnomalies({
      now: new Date('2026-04-20T10:00:00.000Z'),
      thresholds: {
        repeatedFailureCount: 2,
      },
    })

    expect(summary.anomalies).toContainEqual(expect.objectContaining({
      kind: 'repeated_finalize_failure',
      count: 2,
    }))
    expect(summary.anomalies).toContainEqual(expect.objectContaining({
      kind: 'repeated_release_failure',
      count: 2,
    }))
    expect(summary.anomalies.find((anomaly) => anomaly.kind === 'repeated_release_failure')?.examples[0])
      .toMatchObject({
        userId: 'usr_release',
        generationIntentKey: 'intent_release_a',
        failureReason: 'release_failed_timeout',
      })
  })

  it('reports large reserved backlogs without mutating reservation state or calling external services', async () => {
    vi.mocked(listCreditReservationsForReconciliation).mockResolvedValue([
      buildReservation({
        id: 'reservation_reserved_a',
        userId: 'usr_123',
        generationIntentKey: 'intent_reserved_a',
        status: 'reserved',
        createdAt: '2026-04-20T09:20:00.000Z',
      }),
      buildReservation({
        id: 'reservation_reserved_b',
        userId: 'usr_123',
        generationIntentKey: 'intent_reserved_b',
        status: 'reserved',
        createdAt: '2026-04-20T09:21:00.000Z',
      }),
      buildReservation({
        id: 'reservation_reserved_c',
        userId: 'usr_123',
        generationIntentKey: 'intent_reserved_c',
        status: 'reserved',
        createdAt: '2026-04-20T09:22:00.000Z',
      }),
    ])

    const summary = await summarizeBillingAnomalies({
      now: new Date('2026-04-20T10:00:00.000Z'),
      thresholds: {
        reservedBacklogCount: 3,
      },
    })

    expect(listCreditReservationsForReconciliation).toHaveBeenCalledTimes(1)
    expect(summary.anomalies).toContainEqual(expect.objectContaining({
      kind: 'reserved_backlog',
      count: 3,
    }))
    expect(summary.totals.reservedCount).toBe(3)
  })
})
