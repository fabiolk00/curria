import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionCvState } from '@/hooks/use-session-cv-state'
import { generateResume, saveEditedResume } from '@/lib/dashboard/workspace-client'
import { toast } from 'sonner'

import { ResumeEditorModal } from './resume-editor-modal'

vi.mock('@/hooks/use-session-cv-state', () => ({
  useSessionCvState: vi.fn(),
}))

vi.mock('@/lib/dashboard/workspace-client', () => ({
  saveEditedResume: vi.fn(),
  generateResume: vi.fn(),
  isExportAlreadyProcessingError: (error: unknown) => error instanceof Error && error.message === 'EXPORT_ALREADY_PROCESSING',
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}))

const cvState = {
  fullName: 'Ana Silva',
  email: 'ana@example.com',
  phone: '555-0100',
  linkedin: 'linkedin.com/in/anasilva',
  location: 'Sao Paulo',
  summary: 'Base summary',
  experience: [
    {
      title: 'Backend Engineer',
      company: 'Acme',
      location: 'Remote',
      startDate: '2023',
      endDate: 'present',
      bullets: ['Built APIs'],
    },
  ],
  skills: ['TypeScript', 'PostgreSQL'],
  education: [
    {
      degree: 'BSc Computer Science',
      institution: 'USP',
      year: '2022',
      gpa: '',
    },
  ],
  certifications: [],
}

describe('ResumeEditorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSessionCvState).mockReturnValue({
      cvState,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    vi.mocked(saveEditedResume).mockResolvedValue({ changed: true })
    vi.mocked(generateResume).mockResolvedValue({
      success: true,
      scope: 'base',
      creditsUsed: 1,
      generationType: 'ATS_ENHANCEMENT',
      jobId: 'job_123',
      inProgress: true,
    })
  })

  it('renders the loaded resume state', async () => {
    render(
      <ResumeEditorModal
        sessionId="sess_123"
        open
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    expect(screen.getByDisplayValue('Base summary')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Skills' })).toBeInTheDocument()
    expect(useSessionCvState).toHaveBeenCalledWith('sess_123', {
      targetId: null,
      scope: 'base',
    })
  })

  it('skips the save call when nothing changed', async () => {
    const onOpenChange = vi.fn()

    render(
      <ResumeEditorModal
        sessionId="sess_123"
        open
        onOpenChange={onOpenChange}
        onSaved={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /salvar e atualizar pdf/i }))

    expect(saveEditedResume).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('saves edited content and calls onSaved', async () => {
    const onSaved = vi.fn()

    render(
      <ResumeEditorModal
        sessionId="sess_123"
        open
        onOpenChange={vi.fn()}
        onSaved={onSaved}
      />,
    )

    const summary = screen.getByDisplayValue('Base summary')
    await userEvent.clear(summary)
    await userEvent.type(summary, 'Updated summary')
    await userEvent.click(screen.getByRole('button', { name: /salvar e atualizar pdf/i }))

    await waitFor(() => {
      expect(saveEditedResume).toHaveBeenCalledWith('sess_123', {
        scope: 'base',
        cvState: expect.objectContaining({
          summary: 'Updated summary',
        }),
      })
      expect(generateResume).toHaveBeenCalledWith('sess_123', {
        scope: 'base',
      })
    })

    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      summary: 'Updated summary',
    }))
    expect(toast.success).toHaveBeenCalledWith('Edição salva. Atualizando o PDF.')
  })

  it('loads and saves the optimized resume scope when requested', async () => {
    const onSaved = vi.fn()

    render(
      <ResumeEditorModal
        sessionId="sess_123"
        scope="optimized"
        open
        onOpenChange={vi.fn()}
        onSaved={onSaved}
      />,
    )

    expect(useSessionCvState).toHaveBeenCalledWith('sess_123', {
      targetId: null,
      scope: 'optimized',
    })

    const summary = screen.getByDisplayValue('Base summary')
    await userEvent.clear(summary)
    await userEvent.type(summary, 'Optimized summary')
    await userEvent.click(screen.getByRole('button', { name: /salvar e atualizar pdf/i }))

    await waitFor(() => {
      expect(saveEditedResume).toHaveBeenCalledWith('sess_123', {
        scope: 'optimized',
        cvState: expect.objectContaining({
          summary: 'Optimized summary',
        }),
      })
      expect(generateResume).toHaveBeenCalledWith('sess_123', {
        scope: 'base',
      })
    })

    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      summary: 'Optimized summary',
    }))
  })

  it('shows inline errors from failed saves', async () => {
    vi.mocked(saveEditedResume).mockRejectedValue(new Error('save failed'))

    render(
      <ResumeEditorModal
        sessionId="sess_123"
        open
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    const summary = screen.getByDisplayValue('Base summary')
    await userEvent.clear(summary)
    await userEvent.type(summary, 'Updated summary')
    await userEvent.click(screen.getByRole('button', { name: /salvar e atualizar pdf/i }))

    await waitFor(() => {
      expect(screen.getByText('save failed')).toBeInTheDocument()
    })
  })

  it('persists the edit and closes the modal when generation is deferred by an active export', async () => {
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()

    vi.mocked(generateResume).mockRejectedValue(new Error('EXPORT_ALREADY_PROCESSING'))

    render(
      <ResumeEditorModal
        sessionId="sess_123"
        open
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />,
    )

    const summary = screen.getByDisplayValue('Base summary')
    await userEvent.clear(summary)
    await userEvent.type(summary, 'Saved while another export is still running')
    await userEvent.click(screen.getByRole('button', { name: /salvar e atualizar pdf/i }))

    await waitFor(() => {
      expect(saveEditedResume).toHaveBeenCalled()
      expect(generateResume).toHaveBeenCalled()
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
        summary: 'Saved while another export is still running',
      }))
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    expect(screen.queryByText('EXPORT_ALREADY_PROCESSING')).not.toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith(
      'Sua edição foi salva. A exportação atual precisa terminar antes de atualizar o PDF.',
    )
  })
})
