import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { listBillingHistoryForUser } from '@/lib/billing/credit-activity'

import { GET } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/billing/credit-activity', () => ({
  listBillingHistoryForUser: vi.fn(),
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

describe('GET /api/billing/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 before any billing-history lookup when unauthenticated', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('https://example.com/api/billing/history?limit=5'),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(listBillingHistoryForUser).not.toHaveBeenCalled()
  })

  it('returns only the current user billing history with a validated small page size', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(listBillingHistoryForUser).mockResolvedValue({
      entries: [
        {
          createdAt: new Date('2026-04-20T11:00:00.000Z'),
          generationIntentKey: 'intent_123',
          reservationStatus: 'finalized',
          reconciliationStatus: 'clean',
          ledgerEntryType: 'reservation_finalize',
          creditsDelta: -1,
          eventLabel: 'Exportacao concluida e cobrada',
          eventStatus: 'completed',
          sessionId: 'sess_123',
          jobId: 'job_123',
        },
      ],
    })

    const response = await GET(
      new NextRequest('https://example.com/api/billing/history?limit=999'),
    )

    expect(response.status).toBe(200)
    expect(listBillingHistoryForUser).toHaveBeenCalledWith({
      userId: 'usr_123',
      limit: 20,
    })
    expect(await response.json()).toEqual({
      entries: [
        {
          createdAt: '2026-04-20T11:00:00.000Z',
          generationIntentKey: 'intent_123',
          reservationStatus: 'finalized',
          reconciliationStatus: 'clean',
          ledgerEntryType: 'reservation_finalize',
          creditsDelta: -1,
          eventLabel: 'Exportacao concluida e cobrada',
          eventStatus: 'completed',
          sessionId: 'sess_123',
          jobId: 'job_123',
        },
      ],
    })
  })

  it('preserves the plan dto shape instead of leaking raw table rows', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(listBillingHistoryForUser).mockResolvedValue({
      entries: [
        {
          createdAt: new Date('2026-04-20T11:00:00.000Z'),
          generationIntentKey: 'intent_abc',
          reservationStatus: 'needs_reconciliation',
          reconciliationStatus: 'pending',
          ledgerEntryType: 'reservation_finalize',
          creditsDelta: -1,
          eventLabel: 'Cobranca concluida com reconciliacao pendente',
          eventStatus: 'attention',
          sessionId: 'sess_abc',
          jobId: 'job_abc',
          resumeTargetId: 'target_abc',
          resumeGenerationId: 'gen_abc',
        },
      ],
    })

    const response = await GET(
      new NextRequest('https://example.com/api/billing/history?limit=3'),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      entries: [
        {
          createdAt: '2026-04-20T11:00:00.000Z',
          generationIntentKey: 'intent_abc',
          reservationStatus: 'needs_reconciliation',
          reconciliationStatus: 'pending',
          ledgerEntryType: 'reservation_finalize',
          creditsDelta: -1,
          eventLabel: 'Cobranca concluida com reconciliacao pendente',
          eventStatus: 'attention',
          sessionId: 'sess_abc',
          jobId: 'job_abc',
          resumeTargetId: 'target_abc',
          resumeGenerationId: 'gen_abc',
        },
      ],
    })
    expect(payload.entries[0]).not.toHaveProperty('user_id')
    expect(payload.entries[0]).not.toHaveProperty('entry_type')
  })
})
