import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from './route'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import {
  claimAndProcessJob,
  getImportJob,
  type ImportJobRow,
} from '@/lib/linkedin/import-jobs'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/linkedin/import-jobs', () => ({
  claimAndProcessJob: vi.fn(),
  getImportJob: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  serializeError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}))

const JOB_ID = 'job_test_123'
const USER_ID = 'usr_test_1'

function makeRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/profile/status/${JOB_ID}`)
}

function buildJob(overrides: Partial<ImportJobRow> = {}): ImportJobRow {
  return {
    id: JOB_ID,
    user_id: USER_ID,
    linkedin_url: 'https://www.linkedin.com/in/test/',
    status: 'pending',
    error_message: null,
    claimed_at: null,
    completed_at: null,
    created_at: '2026-04-07T00:00:00.000Z',
    updated_at: '2026-04-07T00:00:00.000Z',
    ...overrides,
  }
}

const appUser = { id: USER_ID, email: 'test@curria.com.br' } as unknown as NonNullable<
  Awaited<ReturnType<typeof getCurrentAppUser>>
>

describe('GET /api/profile/status/[jobId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(null)
    const res = await GET(makeRequest(), { params: { jobId: JOB_ID } })
    expect(res.status).toBe(401)
  })

  it('returns 404 when job does not exist', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)
    vi.mocked(getImportJob).mockResolvedValueOnce(null)

    const res = await GET(makeRequest(), { params: { jobId: JOB_ID } })
    expect(res.status).toBe(404)
  })

  it('claims and processes a pending job on-demand', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)
    vi.mocked(getImportJob).mockResolvedValueOnce(buildJob({ status: 'pending' }))
    vi.mocked(claimAndProcessJob).mockResolvedValueOnce(buildJob({ status: 'completed' }))

    const res = await GET(makeRequest(), { params: { jobId: JOB_ID } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('completed')
    expect(claimAndProcessJob).toHaveBeenCalledWith(JOB_ID, USER_ID)
  })

  it('returns current status for already-completed job without processing', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)
    vi.mocked(getImportJob).mockResolvedValueOnce(buildJob({ status: 'completed' }))

    const res = await GET(makeRequest(), { params: { jobId: JOB_ID } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('completed')
    expect(claimAndProcessJob).not.toHaveBeenCalled()
  })

  it('returns current status for processing job without re-claiming', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)
    vi.mocked(getImportJob).mockResolvedValueOnce(buildJob({ status: 'processing' }))

    const res = await GET(makeRequest(), { params: { jobId: JOB_ID } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('processing')
    expect(claimAndProcessJob).not.toHaveBeenCalled()
  })

  it('returns current status for failed job', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)
    vi.mocked(getImportJob).mockResolvedValueOnce(
      buildJob({ status: 'failed', error_message: 'API error' }),
    )

    const res = await GET(makeRequest(), { params: { jobId: JOB_ID } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('failed')
    expect(json.errorMessage).toBe(
      'Nao foi possivel importar esse perfil do LinkedIn agora. Confira se o link esta publico e tente novamente em instantes.',
    )
  })

  it('returns 500 when claimAndProcessJob throws', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)
    vi.mocked(getImportJob).mockResolvedValueOnce(buildJob({ status: 'pending' }))
    vi.mocked(claimAndProcessJob).mockRejectedValueOnce(new Error('boom'))

    const res = await GET(makeRequest(), { params: { jobId: JOB_ID } })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Nao foi possivel acompanhar a importacao do LinkedIn agora. Tente novamente em instantes.')
  })
})
