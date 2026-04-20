import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  listCreditLedgerEntriesForUser,
  listCreditReservationsForUser,
} from '@/lib/db/credit-reservations'
import type { CreditReservation } from '@/lib/db/credit-reservations'
import type { ResumeGenerationType } from '@/types/agent'
import { listBillingHistoryForUser } from './credit-activity'

vi.mock('@/lib/db/credit-reservations', () => ({
  listCreditLedgerEntriesForUser: vi.fn(),
  listCreditReservationsForUser: vi.fn(),
}))

function buildReservation(input: {
  generationIntentKey: string
  status: 'reserved' | 'finalized' | 'released' | 'needs_reconciliation'
  createdAt: string
  sessionId?: string
  resumeTargetId?: string
}): CreditReservation {
  return {
    id: `reservation_${input.generationIntentKey}`,
    userId: 'usr_123',
    generationIntentKey: input.generationIntentKey,
    jobId: `job_${input.generationIntentKey}`,
    sessionId: input.sessionId,
    resumeTargetId: input.resumeTargetId,
    resumeGenerationId: input.status === 'finalized' ? `generation_${input.generationIntentKey}` : undefined,
    type: 'ATS_ENHANCEMENT' as ResumeGenerationType,
    status: input.status,
    creditsReserved: 1,
    failureReason: input.status === 'needs_reconciliation' ? 'finalize_failed' : undefined,
    reservedAt: new Date(input.createdAt),
    finalizedAt: input.status === 'finalized' ? new Date(input.createdAt) : undefined,
    releasedAt: input.status === 'released' ? new Date(input.createdAt) : undefined,
    reconciliationStatus: input.status === 'needs_reconciliation' ? 'pending' : 'clean',
    metadata: { source: 'test' },
    createdAt: new Date(input.createdAt),
    updatedAt: new Date(input.createdAt),
  }
}

function buildLedger(input: {
  generationIntentKey: string
  entryType: 'reservation_hold' | 'reservation_finalize' | 'reservation_release'
  createdAt: string
  sessionId?: string
  resumeTargetId?: string
}) {
  return {
    id: `ledger_${input.generationIntentKey}_${input.entryType}`,
    userId: 'usr_123',
    reservationId: `reservation_${input.generationIntentKey}`,
    generationIntentKey: input.generationIntentKey,
    entryType: input.entryType,
    creditsDelta: input.entryType === 'reservation_release' ? 1 : -1,
    balanceAfter: 4,
    jobId: `job_${input.generationIntentKey}`,
    sessionId: input.sessionId,
    resumeTargetId: input.resumeTargetId,
    resumeGenerationId: input.entryType === 'reservation_finalize' ? `generation_${input.generationIntentKey}` : undefined,
    metadata: { source: 'test' },
    createdAt: new Date(input.createdAt),
  }
}

describe('recent export credit activity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns recent export credit activity ordered newest-first without exposing unrelated users', async () => {
    vi.mocked(listCreditReservationsForUser).mockResolvedValue([
      buildReservation({
        generationIntentKey: 'intent_old',
        status: 'reserved',
        createdAt: '2026-04-20T00:01:00.000Z',
        sessionId: 'session_old',
      }),
      buildReservation({
        generationIntentKey: 'intent_new',
        status: 'finalized',
        createdAt: '2026-04-20T00:05:00.000Z',
        resumeTargetId: 'target_new',
      }),
    ])
    vi.mocked(listCreditLedgerEntriesForUser).mockResolvedValue([
      buildLedger({
        generationIntentKey: 'intent_old',
        entryType: 'reservation_hold',
        createdAt: '2026-04-20T00:01:30.000Z',
        sessionId: 'session_old',
      }),
      buildLedger({
        generationIntentKey: 'intent_new',
        entryType: 'reservation_finalize',
        createdAt: '2026-04-20T00:05:30.000Z',
        resumeTargetId: 'target_new',
      }),
    ])

    const history = await listBillingHistoryForUser({
      userId: 'usr_123',
      limit: 10,
    })

    expect(listCreditReservationsForUser).toHaveBeenCalledWith({ userId: 'usr_123', limit: 10 })
    expect(listCreditLedgerEntriesForUser).toHaveBeenCalledWith({ userId: 'usr_123', limit: 10 })
    expect(history.entries.map((entry) => entry.generationIntentKey)).toEqual(['intent_new', 'intent_old'])
    expect(history.entries[0].createdAt.toISOString()).toBe('2026-04-20T00:05:30.000Z')
  })

  it('maps raw reservation events into localized product-safe labels and statuses', async () => {
    vi.mocked(listCreditReservationsForUser).mockResolvedValue([
      buildReservation({
        generationIntentKey: 'intent_hold',
        status: 'reserved',
        createdAt: '2026-04-20T00:01:00.000Z',
      }),
      buildReservation({
        generationIntentKey: 'intent_finalize',
        status: 'finalized',
        createdAt: '2026-04-20T00:02:00.000Z',
      }),
      buildReservation({
        generationIntentKey: 'intent_release',
        status: 'released',
        createdAt: '2026-04-20T00:03:00.000Z',
      }),
    ])
    vi.mocked(listCreditLedgerEntriesForUser).mockResolvedValue([
      buildLedger({
        generationIntentKey: 'intent_hold',
        entryType: 'reservation_hold',
        createdAt: '2026-04-20T00:01:10.000Z',
      }),
      buildLedger({
        generationIntentKey: 'intent_finalize',
        entryType: 'reservation_finalize',
        createdAt: '2026-04-20T00:02:10.000Z',
      }),
      buildLedger({
        generationIntentKey: 'intent_release',
        entryType: 'reservation_release',
        createdAt: '2026-04-20T00:03:10.000Z',
      }),
    ])

    const history = await listBillingHistoryForUser({ userId: 'usr_123' })

    expect(history.entries.map((entry) => ({
      eventLabel: entry.eventLabel,
      eventStatus: entry.eventStatus,
    }))).toEqual([
      {
        eventLabel: 'Crédito liberado após falha na exportação',
        eventStatus: 'released',
      },
      {
        eventLabel: 'Exportação concluída e cobrada',
        eventStatus: 'completed',
      },
      {
        eventLabel: 'Crédito reservado para exportação',
        eventStatus: 'pending',
      },
    ])
  })

  it('includes created time, generation intent key, reservation status, credits delta, and optional links for later UI work', async () => {
    vi.mocked(listCreditReservationsForUser).mockResolvedValue([
      buildReservation({
        generationIntentKey: 'intent_target',
        status: 'needs_reconciliation',
        createdAt: '2026-04-20T00:04:00.000Z',
        sessionId: 'session_target',
        resumeTargetId: 'target_123',
      }),
    ])
    vi.mocked(listCreditLedgerEntriesForUser).mockResolvedValue([
      buildLedger({
        generationIntentKey: 'intent_target',
        entryType: 'reservation_finalize',
        createdAt: '2026-04-20T00:04:30.000Z',
        sessionId: 'session_target',
        resumeTargetId: 'target_123',
      }),
    ])

    const history = await listBillingHistoryForUser({ userId: 'usr_123' })

    expect(history.entries[0]).toMatchObject({
      generationIntentKey: 'intent_target',
      reservationStatus: 'needs_reconciliation',
      creditsDelta: -1,
      sessionId: 'session_target',
      resumeTargetId: 'target_123',
      eventStatus: 'attention',
      eventLabel: 'Cobrança concluída com reconciliação pendente',
    })
    expect(history.entries[0].createdAt).toBeInstanceOf(Date)
  })
})
