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
      files: { docxUrl: null, pdfUrl: null },
      isLoading: false,
      error: 'Nao foi possivel carregar seus arquivos agora. Tente novamente em instantes.',
      refresh,
    })

    render(<SessionDocumentsPanel isSidebarOpen />)

    expect(screen.getByTestId('session-documents-panel')).toHaveAttribute('data-state', 'error')
    expect(screen.getByText('Nao foi possivel carregar seus arquivos agora. Tente novamente em instantes.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('shows only the PDF artifact in the documents panel', async () => {
    const refresh = vi.fn()

    mockUseSessionDocuments.mockReturnValue({
      files: { docxUrl: null, pdfUrl: 'https://example.com/resume.pdf' },
      isLoading: false,
      error: null,
      refresh,
    })

    render(<SessionDocumentsPanel isSidebarOpen />)

    expect(screen.queryByText('Resume.docx')).not.toBeInTheDocument()
    expect(screen.getByText('Resume.pdf')).toBeInTheDocument()
    expect(screen.getByTestId('session-documents-panel')).toHaveAttribute('data-pdf-available', 'true')
  })
})
