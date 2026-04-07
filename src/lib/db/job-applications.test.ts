import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'

import {
  JOB_APPLICATIONS_FEATURE_UNAVAILABLE_MESSAGE,
  createJobApplication,
  deleteJobApplication,
  getJobApplicationSummaryForUser,
  getJobApplicationsForUser,
  updateJobApplication,
} from './job-applications'

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}))

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app_123',
    user_id: 'usr_123',
    role: 'Desenvolvedor Front-end Senior',
    company: 'Fintech Corp',
    status: 'aguardando',
    salary: 'R$ 14.500,00',
    location: 'Remoto',
    benefits: [{ name: 'VA/VR Flexivel', value: 'R$ 1.200/mes' }],
    resume_version_label: 'Curriculo_Fintech_v2.pdf',
    job_description: 'Vaga para atuar em uma fintech com foco em produto.',
    notes: 'Enviar follow-up na sexta.',
    applied_at: '2026-03-27T12:00:00.000Z',
    created_at: '2026-03-27T12:00:00.000Z',
    updated_at: '2026-03-27T12:00:00.000Z',
    ...overrides,
  }
}

describe('job applications db helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a manual application and applies the default waiting status', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: buildRow(),
      error: null,
    })
    const insertSelect = vi.fn(() => ({
      single: insertSingle,
    }))
    const insert = vi.fn(() => ({
      select: insertSelect,
    }))

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== 'job_applications') {
          throw new Error(`Unexpected table: ${table}`)
        }

        return {
          insert,
        }
      }),
    } as unknown as ReturnType<typeof getSupabaseAdminClient>)

    const created = await createJobApplication({
      userId: 'usr_123',
      role: 'Desenvolvedor Front-end Senior',
      company: 'Fintech Corp',
      salary: 'R$ 14.500,00',
      location: 'Remoto',
      benefits: [{ name: 'VA/VR Flexivel', value: 'R$ 1.200/mes' }],
      resumeVersionLabel: 'Curriculo_Fintech_v2.pdf',
      jobDescription: 'Vaga para atuar em uma fintech com foco em produto.',
      notes: 'Enviar follow-up na sexta.',
    })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.any(String),
      user_id: 'usr_123',
      role: 'Desenvolvedor Front-end Senior',
      company: 'Fintech Corp',
      status: 'aguardando',
      resume_version_label: 'Curriculo_Fintech_v2.pdf',
      benefits: [{ name: 'VA/VR Flexivel', value: 'R$ 1.200/mes' }],
      created_at: expect.any(String),
      updated_at: expect.any(String),
    }))
    expect(created.status).toBe('aguardando')
    expect(created.resumeVersionLabel).toBe('Curriculo_Fintech_v2.pdf')
  })

  it('maps job applications from the database into typed records', async () => {
    const returns = vi.fn().mockResolvedValue({
      data: [
        buildRow({
          id: 'app_new',
          status: 'entrevista',
          applied_at: '2026-03-28T12:00:00.000Z',
          updated_at: '2026-03-28T12:00:00.000Z',
        }),
        buildRow({
          id: 'app_old',
          status: 'negativa',
          applied_at: '2026-03-20T12:00:00.000Z',
          updated_at: '2026-03-20T12:00:00.000Z',
        }),
      ],
      error: null,
    })
    const order = vi.fn(() => ({
      returns,
    }))
    const eqUser = vi.fn(() => ({
      order,
    }))
    const select = vi.fn(() => ({
      eq: eqUser,
    }))

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== 'job_applications') {
          throw new Error(`Unexpected table: ${table}`)
        }

        return {
          select,
        }
      }),
    } as unknown as ReturnType<typeof getSupabaseAdminClient>)

    const applications = await getJobApplicationsForUser('usr_123')

    expect(applications.map((app) => app.id)).toEqual(['app_new', 'app_old'])
    expect(applications[0].status).toBe('entrevista')
    expect(applications[1].status).toBe('negativa')
    expect(applications[0].benefits).toEqual([{ name: 'VA/VR Flexivel', value: 'R$ 1.200/mes' }])
  })

  it('returns a friendly unavailable error when the table is missing from the schema cache', async () => {
    const returns = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("Could not find the table 'public.job_applications' in the schema cache"),
    })
    const order = vi.fn(() => ({
      returns,
    }))
    const eqUser = vi.fn(() => ({
      order,
    }))
    const select = vi.fn(() => ({
      eq: eqUser,
    }))

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== 'job_applications') {
          throw new Error(`Unexpected table: ${table}`)
        }

        return {
          select,
        }
      }),
    } as unknown as ReturnType<typeof getSupabaseAdminClient>)

    await expect(getJobApplicationsForUser('usr_123')).rejects.toThrow(
      JOB_APPLICATIONS_FEATURE_UNAVAILABLE_MESSAGE,
    )
  })

  it('updates and deletes records scoped to the owning user', async () => {
    const updateEqId = vi.fn().mockResolvedValue({ error: null })
    const updateEqUser = vi.fn(() => ({
      eq: updateEqId,
    }))
    const update = vi.fn(() => ({
      eq: updateEqUser,
    }))

    const deleteEqId = vi.fn().mockResolvedValue({ error: null })
    const deleteEqUser = vi.fn(() => ({
      eq: deleteEqId,
    }))
    const del = vi.fn(() => ({
      eq: deleteEqUser,
    }))

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== 'job_applications') {
          throw new Error(`Unexpected table: ${table}`)
        }

        return {
          update,
          delete: del,
        }
      }),
    } as unknown as ReturnType<typeof getSupabaseAdminClient>)

    await updateJobApplication('usr_123', 'app_123', {
      status: 'entrevista',
      notes: 'Recruiter already replied.',
    })

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'entrevista',
      notes: 'Recruiter already replied.',
      updated_at: expect.any(String),
    }))
    expect(updateEqUser).toHaveBeenCalledWith('user_id', 'usr_123')
    expect(updateEqId).toHaveBeenCalledWith('id', 'app_123')

    await deleteJobApplication('usr_123', 'app_123')

    expect(del).toHaveBeenCalledTimes(1)
    expect(deleteEqUser).toHaveBeenCalledWith('user_id', 'usr_123')
    expect(deleteEqId).toHaveBeenCalledWith('id', 'app_123')
  })

  it('returns a friendly unavailable error for writes when the table is missing', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("Could not find the table 'public.job_applications' in the schema cache"),
    })
    const insertSelect = vi.fn(() => ({
      single: insertSingle,
    }))
    const insert = vi.fn(() => ({
      select: insertSelect,
    }))

    const updateEqId = vi.fn().mockResolvedValue({
      error: new Error("Could not find the table 'public.job_applications' in the schema cache"),
    })
    const updateEqUser = vi.fn(() => ({
      eq: updateEqId,
    }))
    const update = vi.fn(() => ({
      eq: updateEqUser,
    }))

    const deleteEqId = vi.fn().mockResolvedValue({
      error: new Error('relation "job_applications" does not exist'),
    })
    const deleteEqUser = vi.fn(() => ({
      eq: deleteEqId,
    }))
    const del = vi.fn(() => ({
      eq: deleteEqUser,
    }))

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        insert,
        update,
        delete: del,
      })),
    } as unknown as ReturnType<typeof getSupabaseAdminClient>)

    await expect(
      createJobApplication({
        userId: 'usr_123',
        role: 'Desenvolvedor Front-end Senior',
        company: 'Fintech Corp',
        resumeVersionLabel: 'Curriculo_Fintech_v2.pdf',
      }),
    ).rejects.toThrow(JOB_APPLICATIONS_FEATURE_UNAVAILABLE_MESSAGE)

    await expect(
      updateJobApplication('usr_123', 'app_123', { status: 'entrevista' }),
    ).rejects.toThrow(JOB_APPLICATIONS_FEATURE_UNAVAILABLE_MESSAGE)

    await expect(
      deleteJobApplication('usr_123', 'app_123'),
    ).rejects.toThrow(JOB_APPLICATIONS_FEATURE_UNAVAILABLE_MESSAGE)
  })

  it('summarizes application counts by status', async () => {
    const returns = vi.fn().mockResolvedValue({
      data: [
        buildRow({ id: 'app_1', status: 'entrevista' }),
        buildRow({ id: 'app_2', status: 'aguardando' }),
        buildRow({ id: 'app_3', status: 'aguardando' }),
        buildRow({ id: 'app_4', status: 'negativa' }),
      ],
      error: null,
    })
    const order = vi.fn(() => ({
      returns,
    }))
    const eqUser = vi.fn(() => ({
      order,
    }))
    const select = vi.fn(() => ({
      eq: eqUser,
    }))

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== 'job_applications') {
          throw new Error(`Unexpected table: ${table}`)
        }

        return {
          select,
        }
      }),
    } as unknown as ReturnType<typeof getSupabaseAdminClient>)

    const summary = await getJobApplicationSummaryForUser('usr_123')

    expect(summary).toEqual({
      total: 4,
      byStatus: {
        entrevista: 1,
        aguardando: 2,
        sem_retorno: 0,
        negativa: 1,
      },
    })
  })
})
