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
})
