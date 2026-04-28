import { beforeEach, describe, expect, it, vi } from 'vitest'

import { runWithApiUsageBuffer, trackApiUsage } from './usage-tracker'

const insertMock = vi.fn()

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: insertMock,
    })),
  })),
}))

vi.mock('@/lib/db/ids', () => ({
  createDatabaseId: vi.fn(() => 'usage_test_id'),
}))

vi.mock('@/lib/db/timestamps', () => ({
  createCreatedAtTimestamp: vi.fn(() => ({ created_at: '2026-04-28T00:00:00.000Z' })),
}))

describe('usage tracker buffering', () => {
  beforeEach(() => {
    insertMock.mockReset()
    insertMock.mockResolvedValue({})
  })

  it('coalesces repeated request usage into one api_usage insert per model', async () => {
    await runWithApiUsageBuffer(async () => {
      await trackApiUsage({
        userId: 'usr_123',
        sessionId: 'sess_123',
        model: 'gpt-5.4-mini',
        inputTokens: 10,
        outputTokens: 5,
        endpoint: 'gap_analysis',
      })
      await trackApiUsage({
        userId: 'usr_123',
        sessionId: 'sess_123',
        model: 'gpt-5.4-mini',
        inputTokens: 20,
        outputTokens: 15,
        endpoint: 'rewriter',
      })
    })

    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: 'usr_123',
        session_id: 'sess_123',
        model: 'gpt-5.4-mini',
        input_tokens: 30,
        output_tokens: 20,
        total_tokens: 50,
        endpoint: 'agent',
      }),
    ])
  })
})
