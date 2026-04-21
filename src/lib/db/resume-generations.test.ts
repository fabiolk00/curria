import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createPendingResumeGeneration,
  PendingResumeGenerationPersistenceError,
  updateResumeGeneration,
} from './resume-generations'
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
  const insertedRows: Array<Record<string, unknown>> = []

  beforeEach(() => {
    vi.clearAllMocks()
    insertedRows.length = 0

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

    insert.mockImplementation((row: Record<string, unknown>) => {
      insertedRows.push(row)
      return {
        select: () => ({
          single: insertSelect,
        }),
      }
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

    expect(result.wasCreated).toBe(false)
    expect(result.generation.id).toBe('gen_existing')
    expect(result.generation.idempotencyKey).toBe('dup_key')
    expect(result.generation.status).toBe('pending')
  })

  it('sets updated_at explicitly on create inserts', async () => {
    insertSelect.mockResolvedValueOnce({
      data: {
        id: 'gen_created',
        user_id: 'usr_123',
        session_id: 'sess_123',
        resume_target_id: null,
        type: 'ATS_ENHANCEMENT',
        status: 'pending',
        idempotency_key: 'new_key',
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

    const result = await createPendingResumeGeneration({
      userId: 'usr_123',
      sessionId: 'sess_123',
      type: 'ATS_ENHANCEMENT',
      idempotencyKey: 'new_key',
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

    expect(result.wasCreated).toBe(true)
    expect(insertedRows).toHaveLength(1)
    expect(insertedRows[0]).toEqual(expect.objectContaining({
      user_id: 'usr_123',
      session_id: 'sess_123',
      resume_target_id: null,
      idempotency_key: 'new_key',
      status: 'pending',
      version_number: 1,
      updated_at: expect.any(String),
    }))
  })

  it('rejects malformed generated_cv_state payloads on update mapping', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'gen_123',
        user_id: 'usr_123',
        session_id: 'sess_123',
        resume_target_id: null,
        type: 'ATS_ENHANCEMENT',
        status: 'completed',
        idempotency_key: null,
        source_cv_snapshot: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          summary: 'Backend engineer',
          experience: [],
          skills: ['TypeScript'],
          education: [],
        },
        generated_cv_state: {
          fullName: 'Ana Silva',
          phone: '555-0100',
          summary: 'Missing email should fail',
          experience: [],
          skills: ['TypeScript'],
          education: [],
        },
        output_pdf_path: null,
        output_docx_path: null,
        failure_reason: null,
        version_number: 1,
        created_at: '2026-04-12T12:00:00.000Z',
        updated_at: '2026-04-12T12:00:00.000Z',
      },
      error: null,
    })

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single,
            })),
          })),
        })),
      })),
    } as never)

    await expect(updateResumeGeneration({
      id: 'gen_123',
      status: 'completed',
    })).rejects.toThrow()
  })

  it('surfaces reuse-specific persistence errors when duplicate idempotency fallback cannot reload the pending generation', async () => {
    maybeSingle.mockRejectedValue(new Error('lookup failed after duplicate'))

    await expect(createPendingResumeGeneration({
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
    })).rejects.toMatchObject({
      name: 'PendingResumeGenerationPersistenceError',
      operation: 'reuse',
      dbCode: '23505',
    } satisfies Partial<PendingResumeGenerationPersistenceError>)
  })
})
