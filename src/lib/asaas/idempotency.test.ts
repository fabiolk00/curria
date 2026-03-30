import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'

import { computeEventFingerprint, getProcessedEvent, recordProcessedEvent } from './idempotency'

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}))

const maybeSingle = vi.fn()
const insert = vi.fn()

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle,
      })),
    })),
    insert,
  })),
}

describe('Asaas webhook idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof getSupabaseAdminClient>,
    )
    maybeSingle.mockResolvedValue({ data: null, error: null })
    insert.mockResolvedValue({ error: null })
  })

  it('produces the same fingerprint regardless of object field order', () => {
    const payloadA = {
      event: 'PAYMENT_RECEIVED' as const,
      payment: {
        id: 'pay_123',
        externalReference: 'curria:v1:u:usr_123:c:chk_123',
        subscription: null,
        amount: 1900,
      },
      amount: 1900,
    }

    const payloadB = {
      amount: 1900,
      payment: {
        subscription: null,
        amount: 1900,
        externalReference: 'curria:v1:u:usr_123:c:chk_123',
        id: 'pay_123',
      },
      event: 'PAYMENT_RECEIVED' as const,
    }

    expect(computeEventFingerprint(payloadA)).toBe(computeEventFingerprint(payloadB))
  })

  it('distinguishes different renewal payloads for the same subscription', () => {
    const firstRenewal = {
      event: 'SUBSCRIPTION_RENEWED' as const,
      amount: 3900,
      subscription: {
        id: 'sub_123',
        externalReference: 'usr_123',
        status: 'ACTIVE',
        nextDueDate: '2026-04-29',
      },
    }

    const secondRenewal = {
      event: 'SUBSCRIPTION_RENEWED' as const,
      amount: 3900,
      subscription: {
        id: 'sub_123',
        externalReference: 'usr_123',
        status: 'ACTIVE',
        nextDueDate: '2026-05-29',
      },
    }

    expect(computeEventFingerprint(firstRenewal)).not.toBe(computeEventFingerprint(secondRenewal))
  })

  it('returns whether an event fingerprint has been processed', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: 'evt_123' }, error: null })

    await expect(getProcessedEvent('fingerprint_123')).resolves.toBe(true)
    await expect(getProcessedEvent('fingerprint_456')).resolves.toBe(false)
  })

  it('records processed events using the fingerprint and payload', async () => {
    const event = {
      event: 'PAYMENT_RECEIVED' as const,
      amount: 1900,
      payment: {
        id: 'pay_123',
        externalReference: 'curria:v1:u:usr_123:c:chk_123',
        subscription: null,
        amount: 1900,
      },
    }

    await recordProcessedEvent('fingerprint_123', event)

    expect(insert).toHaveBeenCalledWith({
      event_id: 'fingerprint_123',
      event_fingerprint: 'fingerprint_123',
      event_type: 'PAYMENT_RECEIVED',
      event_payload: event,
      processed_at: expect.any(String),
    })
  })

  it('distinguishes legacy and v1 external references in normalized fingerprints', () => {
    const v1Payload = {
      event: 'SUBSCRIPTION_RENEWED' as const,
      amount: 3900,
      subscription: {
        id: 'sub_123',
        externalReference: 'curria:v1:u:usr_123:c:chk_123',
        status: 'ACTIVE',
        nextDueDate: '2026-04-29',
      },
    }

    const legacyPayload = {
      event: 'SUBSCRIPTION_RENEWED' as const,
      amount: 3900,
      subscription: {
        id: 'sub_123',
        externalReference: 'usr_123',
        status: 'ACTIVE',
        nextDueDate: '2026-04-29',
      },
    }

    expect(computeEventFingerprint(v1Payload)).not.toBe(computeEventFingerprint(legacyPayload))
  })
})
