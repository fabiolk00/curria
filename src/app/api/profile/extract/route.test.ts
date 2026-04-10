import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from './route'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { createImportJob } from '@/lib/linkedin/import-jobs'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/linkedin/import-jobs', () => ({
  createImportJob: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  serializeError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}))

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/profile/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/profile/extract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(null)
    const res = await POST(makeRequest({ linkedinUrl: 'https://www.linkedin.com/in/test/' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid JSON body', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce({ id: 'usr_1', email: 'a@b.com' } as unknown as NonNullable<Awaited<ReturnType<typeof getCurrentAppUser>>>)
    const req = new NextRequest('http://localhost/api/profile/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json{{{',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Nao foi possivel ler sua solicitacao. Revise o link do LinkedIn e tente novamente.')
  })

  it('returns 400 when URL is not a LinkedIn profile', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce({ id: 'usr_1', email: 'a@b.com' } as unknown as NonNullable<Awaited<ReturnType<typeof getCurrentAppUser>>>)
    const res = await POST(makeRequest({ linkedinUrl: 'https://example.com/user' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Informe um link publico de perfil do LinkedIn no formato https://www.linkedin.com/in/seu-perfil/.')
  })

  it('returns 400 when linkedinUrl is missing', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce({ id: 'usr_1', email: 'a@b.com' } as unknown as NonNullable<Awaited<ReturnType<typeof getCurrentAppUser>>>)
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Informe um link publico de perfil do LinkedIn no formato https://www.linkedin.com/in/seu-perfil/.')
  })

  it('creates a job and returns success on valid URL', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce({ id: 'usr_1', email: 'a@b.com' } as unknown as NonNullable<Awaited<ReturnType<typeof getCurrentAppUser>>>)
    vi.mocked(createImportJob).mockResolvedValueOnce({ jobId: 'job_abc' })

    const res = await POST(makeRequest({ linkedinUrl: 'https://www.linkedin.com/in/testuser/' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.jobId).toBe('job_abc')
    expect(createImportJob).toHaveBeenCalledWith('usr_1', 'https://www.linkedin.com/in/testuser/')
  })

  it('returns 500 when job creation fails', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce({ id: 'usr_1', email: 'a@b.com' } as unknown as NonNullable<Awaited<ReturnType<typeof getCurrentAppUser>>>)
    vi.mocked(createImportJob).mockRejectedValueOnce(new Error('DB down'))

    const res = await POST(makeRequest({ linkedinUrl: 'https://www.linkedin.com/in/testuser/' }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Nao foi possivel iniciar a importacao do LinkedIn agora. Tente novamente em instantes.')
  })
})
