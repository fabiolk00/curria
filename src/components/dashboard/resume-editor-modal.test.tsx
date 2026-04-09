import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionCvState } from '@/hooks/use-session-cv-state'
import { saveEditedResume } from '@/lib/dashboard/workspace-client'

import { ResumeEditorModal } from './resume-editor-modal'

vi.mock('@/hooks/use-session-cv-state', () => ({
  useSessionCvState: vi.fn(),
}))

vi.mock('@/lib/dashboard/workspace-client', () => ({
  saveEditedResume: vi.fn(),
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

    await userEvent.click(screen.getByRole('button', { name: /save and generate pdf/i }))

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
    await userEvent.click(screen.getByRole('button', { name: /save and generate pdf/i }))

    await waitFor(() => {
      expect(saveEditedResume).toHaveBeenCalledWith('sess_123', {
        scope: 'base',
        cvState: expect.objectContaining({
          summary: 'Updated summary',
        }),
      })
    })

    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('adds a skill with the Add button', async () => {
    render(
      <ResumeEditorModal
        sessionId="sess_123"
        open
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Skills' }))
    await userEvent.type(screen.getByPlaceholderText('Add a new skill'), 'AWS')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await userEvent.click(screen.getByRole('button', { name: /save and generate pdf/i }))

    await waitFor(() => {
      expect(saveEditedResume).toHaveBeenCalledWith('sess_123', {
        scope: 'base',
        cvState: expect.objectContaining({
          skills: expect.arrayContaining(['AWS']),
        }),
      })
    })
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
    await userEvent.click(screen.getByRole('button', { name: /save and generate pdf/i }))

    await waitFor(() => {
      expect(screen.getByText('save failed')).toBeInTheDocument()
    })
  })
})
