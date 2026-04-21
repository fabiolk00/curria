import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDownloadUrls } from '@/lib/dashboard/workspace-client'

import { useSessionDocuments } from './use-session-documents'

vi.mock('@/lib/dashboard/workspace-client', () => ({
  getDownloadUrls: vi.fn(),
}))

describe('useSessionDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an idle artifact status when there is no session', () => {
    const { result } = renderHook(() => useSessionDocuments(null))

    expect(result.current.files).toEqual({
      docxUrl: null,
      pdfUrl: null,
      pdfFileName: null,
    })
    expect(result.current.artifactStatus).toEqual({ generationStatus: 'idle' })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(getDownloadUrls).not.toHaveBeenCalled()
  })

  it('maps generating artifact status from the download route response', async () => {
    vi.mocked(getDownloadUrls).mockResolvedValue({
      docxUrl: null,
      pdfUrl: null,
      available: false,
      generationStatus: 'generating',
      jobId: 'job_123',
      stage: 'rendering',
      progress: {
        percent: 60,
        label: 'rendering',
      },
    })

    const { result } = renderHook(() => useSessionDocuments('sess_123'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.files).toEqual({
      docxUrl: null,
      pdfUrl: null,
      pdfFileName: null,
    })
    expect(result.current.artifactStatus).toEqual({
      generationStatus: 'generating',
      jobId: 'job_123',
      stage: 'rendering',
      progress: {
        percent: 60,
        label: 'rendering',
      },
      errorMessage: undefined,
      reconciliation: undefined,
    })
    expect(result.current.error).toBeNull()
  })

  it('maps route failures to a user-facing hook error', async () => {
    vi.mocked(getDownloadUrls).mockRejectedValue(
      new Error('Generated resume artifacts could not be retrieved.'),
    )

    const { result } = renderHook(() => useSessionDocuments('sess_123'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Não foi possível carregar seus arquivos agora. Tente novamente em instantes.')
    expect(result.current.artifactStatus).toEqual({ generationStatus: 'idle' })
  })

  it('captures ready artifact status and signed URLs when a file is available', async () => {
    vi.mocked(getDownloadUrls).mockResolvedValue({
      docxUrl: null,
      pdfFileName: 'Curriculo_Ana_Silva.pdf',
      pdfUrl: 'https://example.com/resume.pdf',
      available: true,
      generationStatus: 'ready',
    })

    const { result } = renderHook(() => useSessionDocuments('sess_123'))

    await waitFor(() => {
      expect(result.current.files.pdfUrl).toBe('https://example.com/resume.pdf')
    })

    expect(result.current.files.pdfFileName).toBe('Curriculo_Ana_Silva.pdf')

    expect(result.current.artifactStatus).toEqual({
      generationStatus: 'ready',
      jobId: undefined,
      stage: undefined,
      progress: undefined,
      errorMessage: undefined,
      reconciliation: undefined,
    })
  })

  it('passes reconciliation detail through the existing polling hook', async () => {
    vi.mocked(getDownloadUrls).mockResolvedValue({
      docxUrl: null,
      pdfFileName: 'Curriculo_Ana_Silva.pdf',
      pdfUrl: 'https://example.com/resume.pdf',
      available: true,
      generationStatus: 'ready',
      stage: 'needs_reconciliation',
      reconciliation: {
        required: true,
        status: 'pending',
        reason: 'billing finalize pending repair',
      },
    })

    const { result } = renderHook(() => useSessionDocuments('sess_123'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.artifactStatus).toEqual({
      generationStatus: 'ready',
      jobId: undefined,
      stage: 'needs_reconciliation',
      progress: undefined,
      errorMessage: undefined,
      reconciliation: {
        required: true,
        status: 'pending',
        reason: 'billing finalize pending repair',
      },
    })
  })
})
