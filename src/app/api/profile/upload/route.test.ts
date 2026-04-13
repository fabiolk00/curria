import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { parseFile } from '@/lib/agent/tools/parse-file'
import { ingestResumeText } from '@/lib/agent/tools/resume-ingestion'
import {
  getExistingUserProfile,
  saveImportedUserProfile,
} from '@/lib/profile/user-profiles'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/agent/tools/parse-file', () => ({
  parseFile: vi.fn(),
}))

vi.mock('@/lib/agent/tools/resume-ingestion', () => ({
  ingestResumeText: vi.fn(),
}))

vi.mock('@/lib/profile/user-profiles', () => ({
  getExistingUserProfile: vi.fn(),
  saveImportedUserProfile: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  serializeError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}))

const appUser = { id: 'usr_123', email: 'ana@example.com' } as Awaited<ReturnType<typeof getCurrentAppUser>>

function makeRequest(file?: File): NextRequest {
  const formData = new FormData()

  if (file) {
    formData.append('file', file)
  }

  return {
    formData: async () => formData,
    signal: new AbortController().signal,
  } as NextRequest
}

describe('POST /api/profile/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(null)

    const res = await POST(makeRequest())

    expect(res.status).toBe(401)
  })

  it('returns 400 when no file is provided', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)

    const res = await POST(makeRequest())
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Selecione um arquivo PDF para importar.')
  })

  it('returns 400 for unsupported file types', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)

    const res = await POST(
      makeRequest(new File(['plain text'], 'resume.txt', { type: 'text/plain' })),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Envie um arquivo PDF.')
  })

  it('returns 400 for DOCX uploads under the PDF-only contract', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)

    const res = await POST(
      makeRequest(
        new File(
          ['docx'],
          'resume.docx',
          { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        ),
      ),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Envie um arquivo PDF.')
    expect(parseFile).not.toHaveBeenCalled()
    expect(ingestResumeText).not.toHaveBeenCalled()
  })

  it('returns 400 for scanned PDFs with too little extracted text', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)
    vi.mocked(parseFile).mockResolvedValueOnce({
      success: false,
      code: 'PARSE_ERROR',
      error: 'PDF_SCANNED - very little text extracted. The file may be image-based.',
    })

    const res = await POST(
      makeRequest(new File(['pdf'], 'resume.pdf', { type: 'application/pdf' })),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe(
      'Nao conseguimos extrair texto desse PDF. Se ele for escaneado, tente outro PDF com texto selecionavel ou preencha manualmente.',
    )
  })

  it('imports a PDF into an empty profile', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)
    vi.mocked(parseFile).mockResolvedValueOnce({
      success: true,
      text: 'Ana Silva\nana@example.com\nBackend engineer',
      pageCount: 1,
    })
    vi.mocked(getExistingUserProfile).mockResolvedValueOnce(null)
    vi.mocked(ingestResumeText).mockResolvedValueOnce({
      strategy: 'populate_empty',
      confidenceScore: 0.82,
      changedFields: ['fullName', 'email', 'summary'],
      preservedFields: [],
      patch: {
        cvState: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          summary: 'Backend engineer',
          phone: '',
          experience: [],
          skills: [],
          education: [],
        },
      },
    })
    vi.mocked(saveImportedUserProfile).mockResolvedValueOnce({
      id: 'profile_123',
      user_id: 'usr_123',
      cv_state: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        summary: 'Backend engineer',
        phone: '',
        experience: [],
        skills: [],
        education: [],
      },
      source: 'pdf',
      linkedin_url: null,
      profile_photo_url: null,
      extracted_at: '2026-04-13T16:00:00.000Z',
      created_at: '2026-04-13T16:00:00.000Z',
      updated_at: '2026-04-13T16:00:00.000Z',
    })

    const res = await POST(
      makeRequest(new File(['pdf'], 'resume.pdf', { type: 'application/pdf' })),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.profile.source).toBe('pdf')
    expect(json.changedFields).toEqual(['fullName', 'email', 'summary'])
    expect(saveImportedUserProfile).toHaveBeenCalledWith({
      appUserId: 'usr_123',
      cvState: expect.objectContaining({
        fullName: 'Ana Silva',
        email: 'ana@example.com',
      }),
      source: 'pdf',
    })
  })

  it('merges imported data into an existing profile without overwriting trusted fields', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)
    vi.mocked(parseFile).mockResolvedValueOnce({
      success: true,
      text: 'resume text',
      pageCount: 1,
    })
    vi.mocked(getExistingUserProfile).mockResolvedValueOnce({
      id: 'profile_123',
      user_id: 'usr_123',
      cv_state: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '',
        summary: 'Trusted summary',
        experience: [],
        skills: ['TypeScript'],
        education: [],
      },
      source: 'manual',
      linkedin_url: null,
      profile_photo_url: null,
      extracted_at: '2026-04-13T16:00:00.000Z',
      created_at: '2026-04-13T16:00:00.000Z',
      updated_at: '2026-04-13T16:00:00.000Z',
    })
    vi.mocked(ingestResumeText).mockResolvedValueOnce({
      strategy: 'merge_preserving_existing',
      confidenceScore: 0.71,
      changedFields: ['phone', 'skills'],
      preservedFields: ['summary'],
      patch: {
        cvState: {
          phone: '+55 11 99999-9999',
          skills: ['TypeScript', 'PostgreSQL'],
        },
      },
    })
    vi.mocked(saveImportedUserProfile).mockResolvedValueOnce({
      id: 'profile_123',
      user_id: 'usr_123',
      cv_state: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '+55 11 99999-9999',
        summary: 'Trusted summary',
        experience: [],
        skills: ['TypeScript', 'PostgreSQL'],
        education: [],
      },
      source: 'pdf',
      linkedin_url: null,
      profile_photo_url: null,
      extracted_at: '2026-04-13T16:00:00.000Z',
      created_at: '2026-04-13T16:00:00.000Z',
      updated_at: '2026-04-13T16:00:00.000Z',
    })

    const res = await POST(
      makeRequest(new File(['pdf'], 'resume.pdf', { type: 'application/pdf' })),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.preservedFields).toEqual(['summary'])
    expect(saveImportedUserProfile).toHaveBeenCalledWith({
      appUserId: 'usr_123',
      cvState: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '+55 11 99999-9999',
        summary: 'Trusted summary',
        experience: [],
        skills: ['TypeScript', 'PostgreSQL'],
        education: [],
      },
      source: 'pdf',
    })
  })

  it('returns 409 without saving when an existing profile would not change', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValueOnce(appUser)
    vi.mocked(parseFile).mockResolvedValueOnce({
      success: true,
      text: 'resume text',
      pageCount: 1,
    })
    vi.mocked(getExistingUserProfile).mockResolvedValueOnce({
      id: 'profile_123',
      user_id: 'usr_123',
      cv_state: {
        fullName: 'Ana Silva',
        email: 'ana@example.com',
        phone: '',
        summary: 'Trusted summary',
        experience: [],
        skills: ['TypeScript'],
        education: [],
      },
      source: 'manual',
      linkedin_url: null,
      profile_photo_url: null,
      extracted_at: '2026-04-13T16:00:00.000Z',
      created_at: '2026-04-13T16:00:00.000Z',
      updated_at: '2026-04-13T16:00:00.000Z',
    })
    vi.mocked(ingestResumeText).mockResolvedValueOnce({
      strategy: 'merge_preserving_existing',
      confidenceScore: 0.76,
      changedFields: [],
      preservedFields: ['fullName', 'email', 'summary', 'skills'],
      patch: {
        cvState: {},
      },
    })

    const res = await POST(
      makeRequest(new File(['pdf'], 'resume.pdf', { type: 'application/pdf' })),
    )
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toBe('Esse arquivo nao trouxe novas informacoes para o seu perfil atual.')
    expect(saveImportedUserProfile).not.toHaveBeenCalled()
  })
})
import type { NextRequest } from 'next/server'
