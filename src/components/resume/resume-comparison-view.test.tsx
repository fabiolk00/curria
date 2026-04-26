import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'

import { ARTIFACT_REFRESH_EVENT } from '@/components/dashboard/events'
import { getDownloadUrls, isRetryableDownloadLookupError } from '@/lib/dashboard/workspace-client'
import {
  CV_HIGHLIGHT_ARTIFACT_VERSION,
  createExperienceBulletHighlightItemId,
  type CvHighlightState,
} from '@/lib/resume/cv-highlight-artifact'
import type { CVState } from '@/types/cv'

import { ResumeComparisonView } from './resume-comparison-view'

const editedOptimizedCvState: CVState = {
  fullName: 'Ana Silva',
  email: 'ana@example.com',
  phone: '555-0100',
  linkedin: 'linkedin.com/in/anasilva',
  location: 'Sao Paulo',
  summary: 'Edited optimized summary',
  experience: [{
    title: 'Senior BI Engineer',
    company: 'Acme',
    startDate: '2024',
    endDate: 'present',
    bullets: ['Edited optimized bullet'],
  }],
  skills: ['TypeScript', 'SQL'],
  education: [],
  certifications: [],
}

vi.mock('@/components/logo', () => ({
  default: () => <div>Logo</div>,
}))

vi.mock('@/lib/dashboard/workspace-client', () => ({
  getDownloadUrls: vi.fn(),
  isRetryableDownloadLookupError: vi.fn(() => false),
}))

vi.mock('@/components/dashboard/resume-editor-modal', () => ({
  ResumeEditorModal: ({
    open,
    scope,
    onSaved,
  }: {
    open: boolean
    scope?: string
    onSaved: (cvState: CVState) => void
  }) => open ? (
    <div data-testid="resume-editor-modal" data-scope={scope ?? 'base'}>
      <button type="button" onClick={() => onSaved(editedOptimizedCvState)}>
        Mock Save
      </button>
    </div>
  ) : null,
}))

function buildCvState(summary: string): CVState {
  return {
    fullName: 'Ana Silva',
    email: 'ana@example.com',
    phone: '555-0100',
    linkedin: 'linkedin.com/in/anasilva',
    location: 'Sao Paulo',
    summary,
    experience: [{
      title: 'Senior BI Engineer',
      company: 'Acme',
      startDate: '2024',
      endDate: 'present',
      bullets: ['Reduced processing time by 40% with Azure Databricks.'],
    }],
    skills: ['TypeScript'],
    education: [],
    certifications: [],
  }
}

function buildHighlightState(): CvHighlightState {
  const optimizedCvState = buildCvState('Optimized summary')

  return {
    source: 'rewritten_cv_state',
    version: CV_HIGHLIGHT_ARTIFACT_VERSION,
    highlightSource: 'ats_enhancement',
    highlightGeneratedAt: '2026-04-22T12:00:00.000Z',
    generatedAt: '2026-04-22T12:00:00.000Z',
    resolvedHighlights: [
      {
        itemId: 'summary_0',
        section: 'summary',
        ranges: [{ start: 0, end: 16, reason: 'ats_strength' }],
      },
      {
        itemId: createExperienceBulletHighlightItemId(
          optimizedCvState.experience[0],
          optimizedCvState.experience[0].bullets[0],
        ),
        section: 'experience',
        ranges: [{ start: 36, end: 52, reason: 'tool_context' }],
      },
    ],
  }
}

describe('ResumeComparisonView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isRetryableDownloadLookupError).mockReturnValue(false)
    vi.mocked(getDownloadUrls).mockResolvedValue({
      available: true,
      docxUrl: null,
      pdfUrl: 'https://example.com/resume.pdf',
      pdfFileName: 'Curriculo_Ana_Silva.pdf',
      generationStatus: 'ready',
      previewLock: undefined,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('opens the editor in optimized mode and updates the optimized document after save', async () => {
    render(
      <ResumeComparisonView
        originalCvState={buildCvState('Original summary')}
        optimizedCvState={buildCvState('Optimized summary')}
        generationType="ATS_ENHANCEMENT"
        sessionId="sess_123"
        highlightState={buildHighlightState()}
        onContinue={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByTitle('Editar currículo'))

    expect(screen.getByTestId('resume-editor-modal')).toHaveAttribute('data-scope', 'optimized')

    await userEvent.click(screen.getByRole('button', { name: 'Mock Save' }))

    expect(screen.getByTestId('optimized-summary-highlight')).toHaveTextContent('Edited optimized summary')
  })

  it('clears visible highlights locally after an optimized manual save', async () => {
    render(
      <ResumeComparisonView
        originalCvState={buildCvState('Original summary')}
        optimizedCvState={buildCvState('Optimized summary')}
        generationType="ATS_ENHANCEMENT"
        sessionId="sess_123"
        highlightState={buildHighlightState()}
        onContinue={vi.fn()}
      />,
    )

    expect(screen.getByTestId('optimized-summary-highlight').querySelector('[data-highlighted="true"]')).not.toBeNull()

    await userEvent.click(screen.getByTitle('Editar currículo'))
    await userEvent.click(screen.getByRole('button', { name: 'Mock Save' }))

    expect(screen.getByTestId('optimized-summary-highlight').querySelector('[data-highlighted="true"]')).toBeNull()
    expect(screen.getByTestId('optimized-bullet-highlight-0-0').querySelector('[data-highlighted="true"]')).toBeNull()
  })

  it('shows a locked overlay and hides edit/download actions for blocked previews', () => {
    render(
      <ResumeComparisonView
        originalCvState={buildCvState('Original summary')}
        optimizedCvState={buildCvState('Preview bloqueado')}
        generationType="ATS_ENHANCEMENT"
        sessionId="sess_123"
        previewLock={{
          locked: true,
          blurred: true,
          reason: 'free_trial_locked',
          requiresUpgrade: true,
          requiresPaidRegeneration: true,
          message: 'Seu preview gratuito está bloqueado. Faça upgrade e gere novamente para liberar o currículo real.',
        }}
        onContinue={vi.fn()}
      />,
    )

    expect(screen.getByTestId('resume-comparison-lock-overlay')).toBeInTheDocument()
    expect(screen.queryByTitle('Editar currículo')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Baixar PDF')).not.toBeInTheDocument()
  })

  it('renders persisted highlights for summary and bullet ranges', () => {
    render(
      <ResumeComparisonView
        originalCvState={buildCvState('Original summary')}
        optimizedCvState={buildCvState('Optimized summary')}
        generationType="ATS_ENHANCEMENT"
        sessionId="sess_123"
        highlightState={buildHighlightState()}
        onContinue={vi.fn()}
      />,
    )

    const summary = screen.getByTestId('optimized-summary-highlight')
    expect(summary.querySelector('[data-highlighted="true"]')).toHaveTextContent('Optimized summar')

    const bullet = screen.getByTestId('optimized-bullet-highlight-0-0')
    const highlighted = bullet.querySelector('[data-highlighted="true"]')
    expect(highlighted).toHaveTextContent('Azure Databricks')
    expect(highlighted).toHaveAttribute('data-highlight-reason', 'tool_context')
    expect(bullet).toHaveTextContent('Reduced processing time by 40% with Azure Databricks.')
  })

  it('renders plain text when no highlight artifact exists', () => {
    render(
      <ResumeComparisonView
        originalCvState={buildCvState('Original summary')}
        optimizedCvState={buildCvState('Optimized summary')}
        generationType="ATS_ENHANCEMENT"
        sessionId="sess_123"
        onContinue={vi.fn()}
      />,
    )

    expect(screen.getByTestId('optimized-summary-highlight').querySelector('[data-highlighted="true"]')).toBeNull()
    expect(screen.getByTestId('optimized-bullet-highlight-0-0').querySelector('[data-highlighted="true"]')).toBeNull()
  })

  it('lets the user hide visual highlights without changing the content', async () => {
    render(
      <ResumeComparisonView
        originalCvState={buildCvState('Original summary')}
        optimizedCvState={buildCvState('Optimized summary')}
        generationType="ATS_ENHANCEMENT"
        sessionId="sess_123"
        highlightState={buildHighlightState()}
        onContinue={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /ocultar destaques/i }))

    expect(screen.getByRole('button', { name: /mostrar destaques/i })).toBeInTheDocument()
    expect(screen.getByTestId('optimized-summary-highlight')).toHaveTextContent('Optimized summary')
    expect(screen.getByTestId('optimized-summary-highlight').querySelector('[data-highlighted="true"]')).toBeNull()
  })

  it('re-enables download after save when a refreshed artifact becomes available', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['pdf'])),
    })
    const createObjectUrl = vi.fn(() => 'blob:resume')
    const revokeObjectUrl = vi.fn()

    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    })

    vi.mocked(getDownloadUrls)
      .mockResolvedValueOnce({
        available: true,
        docxUrl: null,
        pdfUrl: 'https://example.com/resume-before.pdf',
        pdfFileName: 'Curriculo_Ana_Silva.pdf',
        generationStatus: 'ready',
      })
      .mockResolvedValueOnce({
        available: false,
        docxUrl: null,
        pdfUrl: null,
        generationStatus: 'generating',
      })
      .mockResolvedValueOnce({
        available: true,
        docxUrl: null,
        pdfUrl: 'https://example.com/resume-after.pdf',
        pdfFileName: 'Curriculo_Ana_Silva_Atualizado.pdf',
        generationStatus: 'ready',
      })

    render(
      <ResumeComparisonView
        originalCvState={buildCvState('Original summary')}
        optimizedCvState={buildCvState('Optimized summary')}
        generationType="ATS_ENHANCEMENT"
        sessionId="sess_123"
        highlightState={buildHighlightState()}
        onContinue={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(getDownloadUrls).toHaveBeenCalledTimes(1)
    })

    await user.click(screen.getByTitle('Editar currículo'))
    await user.click(screen.getByRole('button', { name: 'Mock Save' }))

    await waitFor(() => {
      expect(screen.getByTestId('optimized-download-status')).toHaveTextContent('Atualizando o PDF salvo para download.')
    })

    const downloadButton = screen.getByTitle('Baixar PDF')
    expect(downloadButton).toBeDisabled()

    await act(async () => {
      window.dispatchEvent(new CustomEvent(ARTIFACT_REFRESH_EVENT, {
        detail: {
          sessionId: 'sess_123',
        },
      }))
    })

    await waitFor(() => {
      expect(getDownloadUrls).toHaveBeenCalledTimes(3)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('optimized-download-status')).not.toBeInTheDocument()
      expect(downloadButton).not.toBeDisabled()
    })

    await user.click(downloadButton)

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/resume-after.pdf')
    expect(createObjectUrl).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:resume')
  })

  it('keeps the user oriented when download lookup is temporarily unavailable', async () => {
    vi.mocked(getDownloadUrls).mockRejectedValueOnce(new Error('temporary lookup failure'))
    vi.mocked(isRetryableDownloadLookupError).mockReturnValue(true)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ResumeComparisonView
        originalCvState={buildCvState('Original summary')}
        optimizedCvState={buildCvState('Optimized summary')}
        generationType="ATS_ENHANCEMENT"
        sessionId="sess_123"
        onContinue={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('optimized-download-status')).toHaveTextContent(
        'Atualizando o PDF salvo para download.',
      )
    })

    expect(screen.getByTitle('Baixar PDF')).toBeDisabled()
  })
})
