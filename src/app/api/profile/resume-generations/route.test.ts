import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { listResumeGenerationHistory } from '@/lib/resume-history/resume-generation-history'

import { GET } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/resume-history/resume-generation-history', () => ({
  listResumeGenerationHistory: vi.fn(),
}))

function buildAppUser(id: string) {
  return {
    id,
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    authIdentity: {
      id: `identity_${id}`,
      userId: id,
      provider: 'clerk' as const,
      providerSubject: `clerk_${id}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    creditAccount: {
      id: `credit_${id}`,
      userId: id,
      creditsRemaining: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }
}

describe('GET /api/profile/resume-generations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests before any history lookup', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('https://example.com/api/profile/resume-generations?page=1&limit=4'),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(listResumeGenerationHistory).not.toHaveBeenCalled()
  })

  it('returns only the current user history with normalized page and limit', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(listResumeGenerationHistory).mockResolvedValue({
      items: [
        {
          id: 'gen_1',
          sessionId: 'sess_1',
          kind: 'chat',
          status: 'completed',
          title: 'Currículo gerado no chat',
          description: 'Versão criada a partir da conversa com a IA.',
          targetRole: null,
          targetJobSnippet: null,
          createdAt: '2026-04-24T10:00:00.000Z',
          completedAt: '2026-04-24T10:05:00.000Z',
          relativeCreatedAt: 'há 1 h',
          pdfAvailable: true,
          docxAvailable: false,
          downloadPdfUrl: '/api/file/sess_1?download=pdf',
          downloadDocxUrl: null,
          viewerUrl: '/dashboard/resume/compare/sess_1',
        },
      ],
      pagination: {
        page: 1,
        limit: 4,
        totalItems: 6,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      },
    })

    const response = await GET(
      new NextRequest('https://example.com/api/profile/resume-generations?page=0&limit=999'),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(listResumeGenerationHistory).toHaveBeenCalledWith({
      userId: 'usr_123',
      page: 1,
      limit: 4,
    })
    expect(payload.pagination.totalItems).toBe(6)
    expect(payload.pagination.limit).toBe(4)
    expect(payload.items[0]).toEqual(expect.objectContaining({
      downloadPdfUrl: '/api/file/sess_1?download=pdf',
      viewerUrl: '/dashboard/resume/compare/sess_1',
    }))
  })

  it('preserves the safe DTO shape instead of leaking raw artifact paths', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(listResumeGenerationHistory).mockResolvedValue({
      items: [
        {
          id: 'gen_2',
          sessionId: 'sess_2',
          kind: 'target_job',
          status: 'failed',
          title: 'Currículo adaptado para vaga',
          description: 'Versão adaptada com base na descrição da vaga informada.',
          targetRole: null,
          targetJobSnippet: 'Senior Data Analyst com SQL e Power BI.',
          createdAt: '2026-04-24T09:00:00.000Z',
          completedAt: null,
          relativeCreatedAt: 'há 2 h',
          pdfAvailable: false,
          docxAvailable: false,
          downloadPdfUrl: null,
          downloadDocxUrl: null,
          viewerUrl: '/dashboard/resume/compare/sess_2',
        },
      ],
      pagination: {
        page: 2,
        limit: 4,
        totalItems: 6,
        totalPages: 2,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    })

    const response = await GET(
      new NextRequest('https://example.com/api/profile/resume-generations?page=2&limit=4'),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.items[0]).not.toHaveProperty('outputPdfPath')
    expect(payload.items[0]).not.toHaveProperty('outputDocxPath')
    expect(payload.items[0]).not.toHaveProperty('userId')
    expect(payload.items[0].downloadPdfUrl).toBeNull()
    expect(payload.items[0].viewerUrl).toBe('/dashboard/resume/compare/sess_2')
  })
})
