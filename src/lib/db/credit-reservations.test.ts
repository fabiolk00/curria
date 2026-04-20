import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ResumeGenerationType } from '@/types/agent'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import {
  getCreditLedgerEntriesForIntent,
  reserveCreditForGenerationIntent,
  settleCreditReservationTransition,
} from './credit-reservations'

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}))

type ReservationStatus = 'reserved' | 'finalized' | 'released' | 'needs_reconciliation'

function buildReservationRow(status: ReservationStatus) {
  return {
    id: 'reservation_123',
    user_id: 'usr_123',
    generation_intent_key: 'intent_123',
    job_id: 'job_123',
    session_id: 'session_123',
    resume_target_id: 'target_123',
    resume_generation_id: null,
    type: 'ATS_ENHANCEMENT' as ResumeGenerationType,
    status,
    credits_reserved: 1,
    failure_reason: status === 'needs_reconciliation' ? 'contradictory_transition' : null,
    reserved_at: '2026-04-20T00:00:00.000Z',
    finalized_at: status === 'finalized' ? '2026-04-20T00:02:00.000Z' : null,
    released_at: status === 'released' ? '2026-04-20T00:02:00.000Z' : null,
    reconciliation_status: status === 'needs_reconciliation' ? 'pending' : 'clean',
    metadata: { source: 'test' },
    created_at: '2026-04-20T00:00:00.000Z',
    updated_at: '2026-04-20T00:02:00.000Z',
  }
}

function buildLedgerRow(entryType: 'reservation_hold' | 'reservation_finalize' | 'reservation_release') {
  return {
    id: `${entryType}_123`,
    user_id: 'usr_123',
    reservation_id: 'reservation_123',
    generation_intent_key: 'intent_123',
    entry_type: entryType,
    credits_delta: entryType === 'reservation_release' ? 1 : -1,
    balance_after: entryType === 'reservation_hold' ? 4 : 4,
    job_id: 'job_123',
    session_id: 'session_123',
    resume_target_id: 'target_123',
    resume_generation_id: entryType === 'reservation_finalize' ? 'generation_123' : null,
    metadata: { evidence: entryType },
    created_at: '2026-04-20T00:03:00.000Z',
  }
}

describe('credit reservation repository', () => {
  const reservationMaybeSingle = vi.fn()
  const reservationInsertSingle = vi.fn()
  const reservationSelect = vi.fn()
  const reservationInsert = vi.fn()
  const reservationEqUser = vi.fn()
  const reservationEqIntent = vi.fn()
  const ledgerSelect = vi.fn()
  const ledgerEq = vi.fn()
  const ledgerOrder = vi.fn()

  const mockSupabase = {
    from: vi.fn((table: string) => {
      if (table === 'credit_reservations') {
        return {
          select: reservationSelect,
          insert: reservationInsert,
        }
      }

      if (table === 'credit_ledger_entries') {
        return {
          select: ledgerSelect,
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof getSupabaseAdminClient>,
    )

    reservationSelect.mockReturnValue({
      eq: reservationEqUser,
    })
    reservationEqUser.mockReturnValue({
      eq: reservationEqIntent,
    })
    reservationEqIntent.mockReturnValue({
      maybeSingle: reservationMaybeSingle,
    })
    reservationInsert.mockReturnValue({
      select: reservationInsertSingle,
    })
    ledgerSelect.mockReturnValue({
      eq: ledgerEq,
    })
    ledgerEq.mockReturnValue({
      order: ledgerOrder,
    })
    ledgerOrder.mockResolvedValue({ data: [], error: null })
  })

  it('returns the existing reservation when the same generation intent is reserved twice', async () => {
    const existingRow = buildReservationRow('reserved')
    reservationMaybeSingle.mockResolvedValueOnce({ data: existingRow, error: null })

    const result = await reserveCreditForGenerationIntent({
      userId: 'usr_123',
      generationIntentKey: 'intent_123',
      generationType: 'ATS_ENHANCEMENT',
      jobId: 'job_123',
      sessionId: 'session_123',
      resumeTargetId: 'target_123',
      metadata: { source: 'test' },
    })

    expect(result.wasCreated).toBe(false)
    expect(result.reservation.status).toBe('reserved')
    expect(reservationInsert).not.toHaveBeenCalled()
  })

  it('surfaces contradictory terminal transitions for reconciliation instead of mutating silently', async () => {
    reservationMaybeSingle.mockResolvedValueOnce({ data: buildReservationRow('released'), error: null })

    await expect(
      settleCreditReservationTransition({
        userId: 'usr_123',
        generationIntentKey: 'intent_123',
        action: 'finalize',
        resumeGenerationId: 'generation_123',
      }),
    ).rejects.toThrow('Cannot finalize credit reservation from released state')
  })

  it('maps append-only hold, finalize, and release ledger entries with optional evidence links', async () => {
    ledgerOrder.mockResolvedValueOnce({
      data: [
        buildLedgerRow('reservation_hold'),
        buildLedgerRow('reservation_finalize'),
        buildLedgerRow('reservation_release'),
      ],
      error: null,
    })

    const entries = await getCreditLedgerEntriesForIntent({
      userId: 'usr_123',
      generationIntentKey: 'intent_123',
    })

    expect(entries.map((entry) => entry.entryType)).toEqual([
      'reservation_hold',
      'reservation_finalize',
      'reservation_release',
    ])
    expect(entries[1]).toMatchObject({
      resumeGenerationId: 'generation_123',
      jobId: 'job_123',
      sessionId: 'session_123',
      resumeTargetId: 'target_123',
    })
  })
})
