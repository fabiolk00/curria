import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SessionDocumentsPanel } from './session-documents-panel'

const mockUseSessionDocuments = vi.fn()
const mockOpenPreview = vi.fn()

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'session' ? 'sess_123' : null),
  }),
}))

vi.mock('@/context/preview-panel-context', () => ({
  usePreviewPanel: () => ({
    file: null,
    open: mockOpenPreview,
  }),
}))

vi.mock('@/hooks/use-session-documents', () => ({
  useSessionDocuments: (sessionId: string | null) => mockUseSessionDocuments(sessionId),
}))

describe('SessionDocumentsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders actionable retry UI when document loading fails', async () => {
    const refresh = vi.fn()
    mockUseSessionDocuments.mockReturnValue({
      files: { docxUrl: null, pdfUrl: null, pdfFileName: null },
      artifactStatus: { generationStatus: 'idle' },
      isLoading: false,
    error: 'Não foi possível carregar seus arquivos agora. Tente novamente em instantes.',
      refresh,
    })

    render(<SessionDocumentsPanel isSidebarOpen />)

    expect(screen.getByTestId('session-documents-panel')).toHaveAttribute('data-state', 'error')
    expect(screen.getByText('Não foi possível carregar seus arquivos agora. Tente novamente em instantes.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('shows only the PDF artifact in the documents panel', () => {
    const refresh = vi.fn()

    mockUseSessionDocuments.mockReturnValue({
      files: {
        docxUrl: null,
        pdfUrl: 'https://example.com/resume.pdf',
        pdfFileName: 'Curriculo_Ana_Silva.pdf',
      },
      artifactStatus: { generationStatus: 'ready' },
      isLoading: false,
      error: null,
      refresh,
    })

    render(<SessionDocumentsPanel isSidebarOpen />)

    expect(screen.queryByText('Resume.docx')).not.toBeInTheDocument()
    expect(screen.getByText('Curriculo_Ana_Silva.pdf')).toBeInTheDocument()
    expect(screen.getByTestId('session-documents-panel')).toHaveAttribute('data-pdf-available', 'true')
  })

  it('re-enables the download button after a failed download attempt', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network failed'))
    mockUseSessionDocuments.mockReturnValue({
      files: {
        docxUrl: null,
        pdfUrl: 'https://example.com/resume.pdf',
        pdfFileName: 'Curriculo_Ana_Silva.pdf',
      },
      artifactStatus: { generationStatus: 'ready' },
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<SessionDocumentsPanel isSidebarOpen />)

    const button = screen.getByTestId('document-item-pdf')
    await userEvent.click(button)

    expect(screen.getByText('Falha no download. Tente novamente.')).toBeInTheDocument()
    expect(button).not.toBeDisabled()

    await userEvent.click(button)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('renders generating status even before a PDF URL exists', () => {
    mockUseSessionDocuments.mockReturnValue({
      files: { docxUrl: null, pdfUrl: null, pdfFileName: null },
      artifactStatus: {
        generationStatus: 'generating',
        jobId: 'job_123',
        stage: 'rendering',
        progress: {
          percent: 60,
          label: 'rendering',
        },
      },
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<SessionDocumentsPanel isSidebarOpen />)

    expect(screen.getByTestId('session-documents-panel')).toHaveAttribute('data-state', 'generating')
    expect(screen.getByText('Preparando sua exportacao. Atualizaremos este arquivo quando estiver pronto.')).toBeInTheDocument()
    expect(screen.getByTestId('documents-progress-label')).toHaveTextContent('rendering (60%)')
  })

  it('renders failed status with the latest durable error message', () => {
    mockUseSessionDocuments.mockReturnValue({
      files: { docxUrl: null, pdfUrl: null, pdfFileName: null },
      artifactStatus: {
        generationStatus: 'failed',
        jobId: 'job_123',
        stage: 'generation_failed',
        errorMessage: 'No credits available to finalize this generation.',
      },
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<SessionDocumentsPanel isSidebarOpen />)

    expect(screen.getByTestId('session-documents-panel')).toHaveAttribute('data-state', 'failed')
    expect(screen.getByText('No credits available to finalize this generation.')).toBeInTheDocument()
    expect(screen.getByTestId('documents-progress-label')).toHaveTextContent('Ultima etapa: Falha na exportacao')
  })

  it('shows a reconciliation notice while keeping the ready PDF available', () => {
    mockUseSessionDocuments.mockReturnValue({
      files: {
        docxUrl: null,
        pdfUrl: 'https://example.com/resume.pdf',
        pdfFileName: 'Curriculo_Ana_Silva_Analista_de_Dados.pdf',
      },
      artifactStatus: {
        generationStatus: 'ready',
        stage: 'needs_reconciliation',
        reconciliation: {
          required: true,
          status: 'pending',
          reason: 'billing finalize pending repair',
        },
      },
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<SessionDocumentsPanel isSidebarOpen />)

    expect(screen.getByText('Estamos conferindo a cobranca desta geracao. Seu arquivo continua disponivel.')).toBeInTheDocument()
    expect(screen.getByText('billing finalize pending repair')).toBeInTheDocument()
    expect(screen.getByText('Curriculo_Ana_Silva_Analista_de_Dados.pdf')).toBeInTheDocument()
  })
})
