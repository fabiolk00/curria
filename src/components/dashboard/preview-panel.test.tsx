import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePreviewPanel } from '@/context/preview-panel-context'
import { getDownloadUrls } from '@/lib/dashboard/workspace-client'

import { PreviewPanel } from './preview-panel'

vi.mock('@/context/preview-panel-context', () => ({
  usePreviewPanel: vi.fn(),
}))

vi.mock('@/hooks/use-preview-panel-overlay', () => ({
  usePreviewPanelOverlay: () => false,
}))

vi.mock('@/lib/dashboard/workspace-client', () => ({
  getDownloadUrls: vi.fn(),
}))

vi.mock('./resume-editor-modal', () => ({
  ResumeEditorModal: ({
    open,
    onOpenChange,
    onSaved,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved: () => void
  }) => (
      <div>
        <div data-testid="resume-editor-state">{open ? 'open' : 'closed'}</div>
      <button type="button" onClick={() => onOpenChange(true)}>simulate modal open</button>
      <button type="button" onClick={onSaved}>trigger saved</button>
    </div>
  ),
}))

describe('PreviewPanel', () => {
  const close = vi.fn()
  const getCachedUrl = vi.fn()
  const setCachedUrl = vi.fn()
  const invalidateCache = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePreviewPanel).mockReturnValue({
      isOpen: false,
      file: null,
      open: vi.fn(),
      close,
      getCachedUrl,
      setCachedUrl,
      invalidateCache,
    })
    getCachedUrl.mockReturnValue(null)
    vi.mocked(getDownloadUrls).mockResolvedValue({
      docxUrl: 'https://example.com/resume.docx',
      pdfUrl: 'https://example.com/resume.pdf',
    })
  })

  it('opens the editor from the toolbar and refreshes URLs after save', async () => {
    render(
      <PreviewPanel
        inline
        showCloseButton={false}
        fileOverride={{
          sessionId: 'sess_123',
          targetId: 'target_123',
          type: 'pdf',
          label: 'Resume',
        }}
      />,
    )

    await waitFor(() => {
      expect(getDownloadUrls).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByTestId('preview-panel')).toHaveAttribute('data-session-id', 'sess_123')
    expect(screen.getByTestId('preview-panel')).toHaveAttribute('data-state', 'ready')
    expect(screen.getByTestId('preview-panel')).toHaveAttribute('data-preview-url', 'https://example.com/resume.pdf')
    expect(screen.getByTestId('preview-panel-frame')).toHaveAttribute('src', 'https://example.com/resume.pdf')
    expect(screen.getByTestId('preview-download-pdf')).toBeInTheDocument()
    expect(screen.getByTestId('preview-open-external')).toHaveAttribute('href', 'https://example.com/resume.pdf')
    expect(setCachedUrl).toHaveBeenCalledWith('sess_123:target_123', 'https://example.com/resume.pdf')

    await userEvent.click(screen.getByTitle('Edit resume'))

    await waitFor(() => {
      expect(screen.getByTestId('resume-editor-state')).toHaveTextContent('open')
    })

    await userEvent.click(screen.getByRole('button', { name: 'trigger saved' }))

    await waitFor(() => {
      expect(invalidateCache).toHaveBeenCalledWith('sess_123:target_123')
      expect(getDownloadUrls).toHaveBeenCalledTimes(2)
    })
  })

  it('shows actionable feedback when preview download fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network failed'))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <PreviewPanel
        inline
        showCloseButton={false}
        fileOverride={{
          sessionId: 'sess_123',
          targetId: 'target_123',
          type: 'pdf',
          label: 'Resume',
        }}
      />,
    )

    await waitFor(() => {
      expect(getDownloadUrls).toHaveBeenCalledTimes(1)
    })

    const button = screen.getByTestId('preview-download-pdf')

    await userEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Falha ao baixar o PDF. Tente novamente.')).toBeInTheDocument()
    })

    expect(button).not.toBeDisabled()

    await userEvent.click(button)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
