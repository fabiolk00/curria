import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPendingResumeGeneration } from './resume-generations'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}))

describe('createPendingResumeGeneration', () => {
  const countEq = vi.fn()
  const insertSelect = vi.fn()
  const insert = vi.fn()
  const maybeSingle = vi.fn()
  const select = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    countEq.mockReturnValue({
      eq: countEq,
      is: vi.fn().mockResolvedValue({ count: 0, error: null }),
    })

    insertSelect.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "resume_generations_idempotency_key_key"',
      },
    })

    maybeSingle.mockResolvedValue({
      data: {
        id: 'gen_existing',
        user_id: 'usr_123',
        session_id: 'sess_123',
        resume_target_id: null,
        type: 'ATS_ENHANCEMENT',
        status: 'pending',
        idempotency_key: 'dup_key',
        source_cv_snapshot: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          summary: 'Backend engineer',
          experience: [],
          skills: ['TypeScript'],
          education: [],
        },
        generated_cv_state: null,
        output_pdf_path: null,
        output_docx_path: null,
        failure_reason: null,
        version_number: 1,
        created_at: '2026-04-12T12:00:00.000Z',
        updated_at: '2026-04-12T12:00:00.000Z',
      },
      error: null,
    })

    select.mockImplementation((columns?: string, options?: { count?: string; head?: boolean }) => {
      if (options?.head) {
        return {
          eq: countEq,
        }
      }

      return {
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle,
          })),
        })),
      }
    })

    insert.mockReturnValue({
      select: () => ({
        single: insertSelect,
      }),
    })

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== 'resume_generations') {
          throw new Error(`Unexpected table: ${table}`)
        }

        return {
          select,
          insert,
        }
      }),
    } as never)
  })

  it('returns the existing generation when a duplicate idempotency key races', async () => {
    const result = await createPendingResumeGeneration({
      userId: 'usr_123',
      sessionId: 'sess_123',
      type: 'ATS_ENHANCEMENT',
      idempotencyKey: 'dup_key',
      sourceCvSnapshot: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '555-0100',
        summary: 'Backend engineer',
        experience: [],
        skills: ['TypeScript'],
        education: [],
      },
    })

    expect(result.id).toBe('gen_existing')
    expect(result.idempotencyKey).toBe('dup_key')
    expect(result.status).toBe('pending')
  })
})
