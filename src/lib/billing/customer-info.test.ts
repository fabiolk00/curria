import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'

import { saveBillingInfo } from './customer-info'

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}))

const upsert = vi.fn()

const mockSupabase = {
  from: vi.fn(() => ({
    upsert,
  })),
}

describe('customer billing info helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof getSupabaseAdminClient>,
    )
    upsert.mockResolvedValue({ error: null })
  })

  it('persists an explicit id and updated_at timestamp for upserts', async () => {
    await saveBillingInfo('usr_123', {
      cpfCnpj: '12345678901',
      phoneNumber: '11999999999',
      address: 'Rua X',
      addressNumber: '123',
      postalCode: '8061022',
      province: 'pr',
    })

    expect(mockSupabase.from).toHaveBeenCalledWith('customer_billing_info')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.any(String),
      user_id: 'usr_123',
      postal_code: '08061022',
      province: 'PR',
      updated_at: expect.any(String),
    }), { onConflict: 'user_id' })
  })
})
