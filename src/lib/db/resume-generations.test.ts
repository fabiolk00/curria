import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createPendingResumeGeneration,
  listRecentResumeGenerationsForUser,
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
        history_kind: 'ats_enhancement',
        history_title: 'Currículo ATS otimizado',
        history_description: 'Melhoria geral para compatibilidade ATS, clareza e estrutura.',
        target_role: null,
        target_job_snippet: null,
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
      historyKind: 'ats_enhancement',
      historyTitle: 'Currículo ATS otimizado',
      historyDescription: 'Melhoria geral para compatibilidade ATS, clareza e estrutura.',
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
        history_kind: 'target_job',
        history_title: 'Currículo para Data Analyst',
        history_description: 'Adaptado para vaga: "Senior Data Analyst com SQL e Power BI."',
        target_role: 'Data Analyst',
        target_job_snippet: 'Senior Data Analyst com SQL e Power BI.',
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
      historyKind: 'target_job',
      historyTitle: 'Currículo para Data Analyst',
      historyDescription: 'Adaptado para vaga: "Senior Data Analyst com SQL e Power BI."',
      targetRole: 'Data Analyst',
      targetJobSnippet: 'Senior Data Analyst com SQL e Power BI.',
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
    expect(result.generation).toMatchObject({
      historyKind: 'target_job',
      historyTitle: 'Currículo para Data Analyst',
      targetRole: 'Data Analyst',
      targetJobSnippet: 'Senior Data Analyst com SQL e Power BI.',
    })
    expect(insertedRows).toHaveLength(1)
    expect(insertedRows[0]).toEqual(expect.objectContaining({
      user_id: 'usr_123',
      session_id: 'sess_123',
      resume_target_id: null,
      idempotency_key: 'new_key',
      history_kind: 'target_job',
      history_title: 'Currículo para Data Analyst',
      history_description: 'Adaptado para vaga: "Senior Data Analyst com SQL e Power BI."',
      target_role: 'Data Analyst',
      target_job_snippet: 'Senior Data Analyst com SQL e Power BI.',
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
        history_kind: 'ats_enhancement',
        history_title: 'Currículo ATS otimizado',
        history_description: 'Melhoria geral para compatibilidade ATS, clareza e estrutura.',
        target_role: null,
        target_job_snippet: null,
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

  it('persists history metadata and completion timestamps when a generation completes', async () => {
    const capturedUpdates: Array<Record<string, unknown>> = []
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'gen_123',
        user_id: 'usr_123',
        session_id: 'sess_123',
        resume_target_id: 'target_123',
        type: 'JOB_TARGETING',
        status: 'completed',
        idempotency_key: 'profile-target:sess_123',
        history_kind: 'target_job',
        history_title: 'Currículo para Data Analyst',
        history_description: 'Adaptado para vaga: "Senior Data Analyst com SQL e Power BI."',
        target_role: 'Data Analyst',
        target_job_snippet: 'Senior Data Analyst com SQL e Power BI.',
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
          email: 'ana@example.com',
          phone: '555-0100',
          summary: 'Backend engineer focused on analytics.',
          experience: [],
          skills: ['TypeScript'],
          education: [],
        },
        output_pdf_path: 'usr_123/sess_123/target_123/resume.pdf',
        output_docx_path: null,
        failure_reason: null,
        error_message: null,
        version_number: 1,
        created_at: '2026-04-12T12:00:00.000Z',
        updated_at: '2026-04-12T12:05:00.000Z',
        completed_at: '2026-04-12T12:05:00.000Z',
        failed_at: null,
      },
      error: null,
    })

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn((payload: Record<string, unknown>) => {
          capturedUpdates.push(payload)

          return {
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single,
              })),
            })),
          }
        }),
      })),
    } as never)

    const completedAt = new Date('2026-04-12T12:05:00.000Z')
    const result = await updateResumeGeneration({
      id: 'gen_123',
      status: 'completed',
      outputPdfPath: 'usr_123/sess_123/target_123/resume.pdf',
      historyKind: 'target_job',
      historyTitle: 'Currículo para Data Analyst',
      historyDescription: 'Adaptado para vaga: "Senior Data Analyst com SQL e Power BI."',
      targetRole: 'Data Analyst',
      targetJobSnippet: 'Senior Data Analyst com SQL e Power BI.',
      errorMessage: null,
      completedAt,
      failedAt: null,
    })

    expect(capturedUpdates[0]).toEqual(expect.objectContaining({
      status: 'completed',
      history_kind: 'target_job',
      history_title: 'Currículo para Data Analyst',
      history_description: 'Adaptado para vaga: "Senior Data Analyst com SQL e Power BI."',
      target_role: 'Data Analyst',
      target_job_snippet: 'Senior Data Analyst com SQL e Power BI.',
      completed_at: completedAt.toISOString(),
      failed_at: null,
      error_message: null,
    }))
    expect(result).toMatchObject({
      historyKind: 'target_job',
      historyTitle: 'Currículo para Data Analyst',
      targetRole: 'Data Analyst',
      completedAt,
    })
  })

  it('surfaces reuse-specific persistence errors when duplicate idempotency fallback cannot reload the pending generation', async () => {
    maybeSingle.mockRejectedValue(new Error('lookup failed after duplicate'))

    await expect(createPendingResumeGeneration({
      userId: 'usr_123',
      sessionId: 'sess_123',
      type: 'ATS_ENHANCEMENT',
      idempotencyKey: 'dup_key',
      historyKind: 'ats_enhancement',
      historyTitle: 'Currículo ATS otimizado',
      historyDescription: 'Melhoria geral para compatibilidade ATS, clareza e estrutura.',
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

  it('lists only the current user history scope when querying recent generations', async () => {
    const eq = vi.fn()
    const order = vi.fn()
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'gen_own',
          user_id: 'usr_123',
          session_id: 'sess_123',
          resume_target_id: null,
          type: 'ATS_ENHANCEMENT',
          status: 'completed',
          idempotency_key: 'profile-ats:sess_123',
          history_kind: 'ats_enhancement',
          history_title: 'Currículo ATS otimizado',
          history_description: 'Melhoria geral para compatibilidade ATS, clareza e estrutura.',
          target_role: null,
          target_job_snippet: null,
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
          output_pdf_path: 'usr_123/sess_123/resume.pdf',
          output_docx_path: null,
          failure_reason: null,
          error_message: null,
          version_number: 1,
          created_at: '2026-04-12T12:00:00.000Z',
          updated_at: '2026-04-12T12:05:00.000Z',
          completed_at: '2026-04-12T12:05:00.000Z',
          failed_at: null,
        },
      ],
      error: null,
    })

    order.mockReturnValue({
      limit,
    })

    eq.mockReturnValue({
      order,
    })

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq,
        })),
      })),
    } as never)

    const result = await listRecentResumeGenerationsForUser('usr_123', 6)

    expect(eq).toHaveBeenCalledWith('user_id', 'usr_123')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(limit).toHaveBeenCalledWith(6)
    expect(result).toHaveLength(1)
    expect(result[0].userId).toBe('usr_123')
  })
})
