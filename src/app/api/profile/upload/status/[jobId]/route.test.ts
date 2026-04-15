import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from './route'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getPdfImportJob, startPdfImportJobProcessing } from '@/lib/profile/pdf-import-jobs'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/profile/pdf-import-jobs', () => ({
  getPdfImportJob: vi.fn(),
  startPdfImportJobProcessing: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  serializeError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}))

const JOB_ID = 'job_pdf_123'
const USER_ID = 'usr_123'

function makeRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/profile/upload/status/${JOB_ID}`)
}

function buildJob(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    user_id: USER_ID,
    storage_path: `imports/${USER_ID}/${JOB_ID}/resume.pdf`,
    source_file_name: 'resume.pdf',
    source_file_size: 1_500_000,
    status: 'pending',
    replace_linkedin_import: false,
    error_message: null,
    warning_message: null,
    claimed_at: null,
    completed_at: null,
    created_at: '2026-04-14T10:00:00.000Z',
    updated_at: '2026-04-14T10:00:00.000Z',
    ...overrides,
  }
}

const appUser = { id: USER_ID, email: 'ana@example.com' } as unknown as NonNullable<
  Awaited<ReturnType<typeof getCurrentAppUser>>
>

describe('GET /api/profile/upload/status/[jobId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(null)

    const res = await GET(makeRequest(), { params: { jobId: JOB_ID } })

    expect(res.status).toBe(401)
  })

  it('returns 404 when the PDF import job does not exist', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)
    vi.mocked(getPdfImportJob).mockResolvedValueOnce(null)

    const res = await GET(makeRequest(), { params: { jobId: JOB_ID } })

    expect(res.status).toBe(404)
  })

  it('claims a pending job on the status route and returns the processing state', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)
    vi.mocked(getPdfImportJob).mockResolvedValueOnce(buildJob({ status: 'pending' }) as never)
    vi.mocked(startPdfImportJobProcessing).mockResolvedValueOnce(
      buildJob({
        status: 'processing',
        claimed_at: '2026-04-14T10:01:00.000Z',
      }) as never,
    )

    const res = await GET(makeRequest(), { params: { jobId: JOB_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
      jobId: JOB_ID,
      status: 'processing',
      errorMessage: undefined,
      warningMessage: undefined,
    })
    expect(startPdfImportJobProcessing).toHaveBeenCalledWith(JOB_ID, USER_ID)
  })

  it('returns completed jobs without re-triggering processing', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)
    vi.mocked(getPdfImportJob).mockResolvedValueOnce(
      buildJob({
        status: 'completed',
        claimed_at: '2026-04-14T10:01:00.000Z',
        completed_at: '2026-04-14T10:02:00.000Z',
        warning_message: 'Revise os dados importados antes de salvar.',
      }) as never,
    )

    const res = await GET(makeRequest(), { params: { jobId: JOB_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
      jobId: JOB_ID,
      status: 'completed',
      errorMessage: undefined,
      warningMessage: 'Revise os dados importados antes de salvar.',
    })
    expect(startPdfImportJobProcessing).not.toHaveBeenCalled()
  })
})
