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
import type { JobTargetingExplanation } from '@/types/agent'
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

function buildReviewItem(overrides: Partial<NonNullable<CvHighlightState["reviewItems"]>[number]> = {}): NonNullable<CvHighlightState["reviewItems"]>[number] {
  return {
    id: "review-item-1",
    severity: "risk",
    section: "summary",
    title: "Ponto para revisar",
    explanation: "Revise o texto antes de enviar.",
    whyItMatters: "Evita desalinhamento com o currículo original.",
    suggestedAction: "Ajuste a redação para manter fidelidade ao histórico.",
    message: "Revise o texto antes de enviar.",
    inline: false,
    ...overrides,
  }
}

function buildJobTargetingExplanation(): JobTargetingExplanation {
  return {
    targetRole: "Analista de BI",
    targetRoleConfidence: "high",
    generatedAt: "2026-04-29T12:00:00.000Z",
    source: "job_targeting",
    version: 1,
    scoreBreakdown: {
      total: 72,
      maxTotal: 100,
      items: [
        { id: "skills", label: "Habilidades", score: 82, max: 100 },
        { id: "experience", label: "Experiência", score: 61, max: 100 },
        { id: "education", label: "Formação", score: 90, max: 100 },
      ],
      criticalGaps: ["P&L, margem, faturamento, forecast e budget"],
    },
    targetRecommendations: [{
      id: "target-rec-dax",
      kind: "adjacent_skill",
      priority: "high",
      jobRequirement: "DAX",
      currentEvidence: ["Power BI"],
      suggestedUserAction: "A vaga pede DAX. Seu currículo mostra Power BI. Se você realmente tem experiência com DAX, adicione isso explicitamente.",
      safeExample: "Se for verdadeiro: use DAX em uma experiência real.",
      mustNotInvent: true,
      relatedResumeSection: "skills",
      relatedEvidenceLevel: "adjacent",
    }],
  }
}

function buildJobTargetingExplanationWithReview(): JobTargetingExplanation {
  return {
    ...buildJobTargetingExplanation(),
    userFriendlyReview: {
      title: "Antes de gerar, precisamos revisar alguns pontos",
      description: "A vaga pede algumas experiências que ainda não aparecem claramente no seu currículo. Para proteger sua candidatura, não vamos afirmar algo sem evidência.",
      fitLevel: "partial",
      canGenerateConservativeVersion: true,
      requirements: [
        {
          id: "sap-fi",
          label: "SAP FI",
          status: "needs_evidence",
          explanation: "A vaga pede SAP FI, mas não encontramos essa experiência no seu currículo.",
          foundEvidence: [],
          safeSuggestion: "Vamos gerar uma versão honesta, destacando experiências próximas sem afirmar SAP FI diretamente.",
          canAddEvidence: true,
        },
      ],
    },
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
    expect(screen.queryByTestId('override-review-panel')).not.toBeInTheDocument()
  })

  it('renders warning generations as review highlights instead of normal match copy', () => {
    const highlightState: CvHighlightState = {
      source: 'rewritten_cv_state',
      version: CV_HIGHLIGHT_ARTIFACT_VERSION,
      highlightSource: 'job_targeting',
      highlightMode: 'override_review',
      highlightGeneratedAt: '2026-04-22T12:00:00.000Z',
      generatedAt: '2026-04-22T12:00:00.000Z',
      resolvedHighlights: [{
        itemId: 'summary_0',
        section: 'summary',
        ranges: [{ start: 0, end: 18, reason: 'risk' }],
      }],
      reviewItems: [buildReviewItem({
        id: "review-low-fit-inline",
        issueType: 'low_fit_target_role',
        title: "Cargo da vaga assumido com pouca evidência",
        explanation: "A versão gerada pode estar se aproximando demais do cargo “Vendedora/Vendedor JR”.",
        whyItMatters: "Seu currículo original comprova melhor uma trajetória em Engenharia de Dados e BI.",
        suggestedAction: "Revise o resumo para manter sua identidade profissional real.",
        offendingText: 'Desenvolvedor Java',
        targetRole: "Vendedora/Vendedor JR",
        originalProfileLabel: "Engenharia de Dados e BI",
        inline: true,
      })],
    }

    render(
      <ResumeComparisonView
        originalCvState={buildCvState('Original summary')}
        optimizedCvState={buildCvState('Desenvolvedor Java com foco em eventos.')}
        generationType="JOB_TARGETING"
        sessionId="sess_review"
        highlightState={highlightState}
        onContinue={vi.fn()}
      />,
    )

    expect(screen.getAllByText('Pontos para revisar').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Revise os trechos marcados antes de enviar/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Match da vaga')).not.toBeInTheDocument()
    expect(screen.getByTestId('override-review-panel')).toHaveTextContent('Cargo da vaga assumido com pouca evidência')
    const highlighted = screen.getByTestId('optimized-summary-highlight').querySelector('[data-highlighted="true"]')
    expect(highlighted).toHaveTextContent('Desenvolvedor Java')
    expect(highlighted).toHaveAttribute('data-highlight-reason', 'risk')
  })

  it('renders job targeting score beside the generated resume without adherence suggestions', async () => {
    render(
      <ResumeComparisonView
        originalCvState={buildCvState('Original summary')}
        optimizedCvState={buildCvState('Optimized summary')}
        generationType="JOB_TARGETING"
        sessionId="sess_explanation"
        jobTargetingExplanation={buildJobTargetingExplanation()}
        creditsRemaining={7}
        maxCredits={12}
        onContinue={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('job-targeting-explanation')).not.toBeInTheDocument()
    expect(screen.queryByText('Entenda o que mudou')).not.toBeInTheDocument()
    expect(screen.queryByText('Sugestões para melhorar sua aderência')).not.toBeInTheDocument()
    expect(screen.queryByText('Só se for verdadeiro')).not.toBeInTheDocument()
    expect(screen.queryByTestId('job-targeting-diagnostic-column')).not.toBeInTheDocument()
    expect(screen.getByTestId('job-targeting-score-card')).toBeInTheDocument()
    expect(screen.getByText('Compatibilidade com a vaga')).toBeInTheDocument()
    expect(screen.getByText('Composição da nota')).toBeInTheDocument()
    expect(screen.getByLabelText('Nota de Habilidades')).toHaveAttribute('aria-valuenow', '82')
    expect(screen.queryByText('Original')).not.toBeInTheDocument()
    expect(screen.queryByTestId('original-resume-document')).not.toBeInTheDocument()
    expect(screen.getByText('Currículo ATS Otimizado')).toBeInTheDocument()
    expect(screen.getByText('Use as dicas de ATS para ajustar seu currículo e, em seguida, baixe a versão editada em PDF.')).toBeInTheDocument()
    expect(screen.getByText('Logo')).toBeInTheDocument()
    expect(screen.getByTestId('comparison-credits-badge')).toHaveTextContent('Créditos disponíveis')
    expect(screen.getByTestId('comparison-credits-badge')).toHaveTextContent('7 / 12')
    expect(screen.getByTestId('job-target-resume-frame')).toHaveAttribute('data-collapsed', 'false')
    expect(screen.getByTestId('job-target-resume-frame')).toHaveClass('overflow-visible')
    expect(screen.getByRole('button', { name: /ocultar currículo/i })).toBeInTheDocument()
  })

  it('renders a user-friendly job review when the explanation includes requirement evidence', () => {
    render(
      <ResumeComparisonView
        originalCvState={buildCvState('Original summary')}
        optimizedCvState={buildCvState('Optimized summary')}
        generationType="JOB_TARGETING"
        sessionId="sess_explanation_review"
        jobTargetingExplanation={buildJobTargetingExplanationWithReview()}
        onContinue={vi.fn()}
      />,
    )

    const panel = screen.getByTestId('job-targeting-review-panel')
    expect(screen.getByTestId('job-targeting-diagnostic-column')).toContainElement(panel)
    expect(panel).toHaveTextContent('Diagnostico da versao gerada')
    expect(panel).not.toHaveTextContent('Revisão antes de gerar')
    expect(panel).toHaveTextContent('Precisa de evidência')
    expect(panel).toHaveTextContent('SAP FI')
    expect(panel.textContent ?? '').not.toMatch(/forbidden_term|claim_policy|unsupported_claim|validation block|override|gerar mesmo assim/i)
    expect(screen.getByTestId('job-targeting-score-card')).toBeInTheDocument()
  })

  it('keeps the original resume comparison for ATS enhancement generations', () => {
    render(
      <ResumeComparisonView
        originalCvState={buildCvState('Original summary')}
        optimizedCvState={buildCvState('Optimized summary')}
        generationType="ATS_ENHANCEMENT"
        sessionId="sess_ats_compare"
        creditsRemaining={3}
        onContinue={vi.fn()}
      />,
    )

    expect(screen.getByText('Original')).toBeInTheDocument()
    expect(screen.getByTestId('original-resume-document')).toBeInTheDocument()
    expect(screen.getByTestId('optimized-resume-document')).toBeInTheDocument()
    expect(screen.queryByTestId('job-targeting-diagnostic-column')).not.toBeInTheDocument()
    expect(screen.getByText('Logo')).toBeInTheDocument()
    expect(screen.getByTestId('comparison-credits-badge')).toHaveTextContent('3')
    expect(screen.getByRole('button', { name: 'Voltar ao Perfil' })).toBeInTheDocument()
  })

  it('shows a review panel outside the resume body when override has no inline highlights', () => {
    const highlightState: CvHighlightState = {
      source: 'rewritten_cv_state',
      version: CV_HIGHLIGHT_ARTIFACT_VERSION,
      highlightSource: 'job_targeting',
      highlightMode: 'override_review',
      highlightGeneratedAt: '2026-04-22T12:00:00.000Z',
      generatedAt: '2026-04-22T12:00:00.000Z',
      resolvedHighlights: [],
      reviewItems: [
        buildReviewItem({
          id: "review-skill",
          issueType: 'summary_skill_without_evidence',
          title: "Skill sem comprovação clara",
          explanation: "O resumo pode mencionar “vendas consultivas”, mas essa habilidade não aparece claramente no currículo original.",
          message: "O resumo pode mencionar “vendas consultivas”, mas essa habilidade não aparece claramente no currículo original.",
        }),
        buildReviewItem({
          id: "review-low-fit",
          issueType: 'low_fit_target_role',
          title: "Cargo da vaga assumido com pouca evidência",
          explanation: "A versão gerada pode estar se aproximando demais do cargo “Vendedora/Vendedor JR”.",
          whyItMatters: "Seu currículo original comprova melhor uma trajetória em Engenharia de Dados e BI.",
          suggestedAction: "Revise o resumo para manter sua identidade profissional real.",
          targetRole: "Vendedora/Vendedor JR",
          originalProfileLabel: "Engenharia de Dados e BI",
          missingEvidence: ["metas comerciais", "relacionamento com clientes"],
        }),
      ],
    }

    render(
      <ResumeComparisonView
        originalCvState={buildCvState('Original summary')}
        optimizedCvState={buildCvState('Resumo targetizado para marketing.')}
        generationType="JOB_TARGETING"
        sessionId="sess_review_text"
        highlightState={highlightState}
        onContinue={vi.fn()}
      />,
    )

    const panel = screen.getByTestId('override-review-panel')
    expect(screen.queryByText(/Este currículo foi gerado com pontos de atenção/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Revise os itens abaixo antes de enviar/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Revise os trechos marcados antes de enviar/i)).not.toBeInTheDocument()
    expect(panel).toHaveTextContent('Pontos para revisar')
    expect(panel).toHaveTextContent('Experiência relevante')
    expect(panel).toHaveTextContent('Seu perfil comprovado')
    expect(panel).toHaveTextContent('Pontos sem evidência suficiente')
    expect(panel).toHaveTextContent('Por que revisar')
    expect(panel).toHaveTextContent('Skill sem comprovação clara')
    expect(panel).toHaveTextContent('Cargo da vaga assumido com pouca evidência')
    expect(panel).not.toHaveTextContent('Não há trechos destacados automaticamente')
    expect(screen.queryByText('Match da vaga')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ocultar destaques/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /skill sem comprovação clara/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/trecho sustentado pelo currículo original/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('optimized-resume-document')).not.toContainElement(panel)
  })

  it('collapses only the job targeting resume while review points keep their own scroll area', async () => {
    const user = userEvent.setup()
    const highlightState: CvHighlightState = {
      source: 'rewritten_cv_state',
      version: CV_HIGHLIGHT_ARTIFACT_VERSION,
      highlightSource: 'job_targeting',
      highlightMode: 'override_review',
      highlightGeneratedAt: '2026-04-22T12:00:00.000Z',
      generatedAt: '2026-04-22T12:00:00.000Z',
      resolvedHighlights: [],
      reviewItems: [
        buildReviewItem({
          id: "review-scroll-area",
        title: "Gestão financeira sem evidência",
        explanation: "Revise antes de enviar.",
        message: "Revise antes de enviar.",
        whyItMatters: "Revise antes de enviar.",
      }),
      ],
    }

    render(
      <ResumeComparisonView
        originalCvState={buildCvState('Original summary')}
        optimizedCvState={buildCvState('Optimized summary')}
        generationType="JOB_TARGETING"
        sessionId="sess_collapse"
        highlightState={highlightState}
        jobTargetingExplanation={buildJobTargetingExplanation()}
        onContinue={vi.fn()}
      />,
    )

    expect(screen.getByTestId('optimized-resume-document')).toBeInTheDocument()
    expect(screen.getByTestId('job-target-resume-frame')).toHaveAttribute('data-collapsed', 'false')
    expect(screen.getByTestId('job-target-resume-frame')).toHaveClass('overflow-visible')
    expect(screen.getByTestId('override-review-panel-scroll')).toHaveClass('lg:overflow-y-auto')
    expect(screen.getByRole('button', { name: /ocultar currículo/i }).parentElement).toHaveClass('hidden', 'lg:flex')

    const diagnosticColumn = screen.getByTestId('job-targeting-diagnostic-column')
    const scoreCard = screen.getByTestId('job-targeting-score-card')
    const resumeFrame = screen.getByTestId('job-target-resume-frame')
    const reviewPanel = screen.getByTestId('override-review-panel')
    expect(diagnosticColumn).toContainElement(scoreCard)
    expect(diagnosticColumn).toContainElement(reviewPanel)
    expect(diagnosticColumn).toHaveClass('space-y-4', 'lg:col-start-2', 'lg:row-start-1')
    expect(resumeFrame.parentElement).toHaveClass('lg:col-start-1', 'lg:row-start-1')
    expect(resumeFrame.parentElement).not.toHaveClass('lg:row-span-2')

    await user.click(screen.getByRole('button', { name: /ocultar currículo/i }))

    expect(screen.getByTestId('optimized-resume-document')).toBeInTheDocument()
    expect(screen.getByTestId('job-target-resume-frame')).toHaveAttribute('data-collapsed', 'true')
    expect(screen.getByTestId('job-target-resume-frame')).toHaveClass('lg:max-h-[52vh]', 'lg:overflow-hidden')
    expect(screen.getByRole('button', { name: /abrir currículo/i })).toBeInTheDocument()
    expect(screen.getByTestId('override-review-panel')).toHaveTextContent('Pontos para revisar')
    expect(screen.getByTestId('override-review-panel-scroll')).toHaveClass('lg:overflow-y-auto')

    await user.click(screen.getByRole('button', { name: /abrir currículo/i }))

    expect(screen.getByTestId('optimized-resume-document')).toBeInTheDocument()
    expect(screen.getByTestId('job-target-resume-frame')).toHaveAttribute('data-collapsed', 'false')
    expect(screen.getByTestId('job-target-resume-frame')).toHaveClass('overflow-visible')
    expect(screen.getByTestId('override-review-panel')).toHaveTextContent('Pontos para revisar')
  })

  it('repairs mojibake in review issue copy before rendering', () => {
    const brokenMessage = [
      'Revise o curr',
      '\u00c3\u00ad',
      'culo com aten',
      '\u00c3\u00a7\u00c3\u00a3',
      'o para evitar aproxima',
      '\u00c3\u00a7\u00c3\u00a3',
      'o sem evid',
      '\u00c3\u00aa',
      'ncia.',
    ].join('')
    const highlightState: CvHighlightState = {
      source: 'rewritten_cv_state',
      version: CV_HIGHLIGHT_ARTIFACT_VERSION,
      highlightSource: 'job_targeting',
      highlightMode: 'override_review',
      highlightGeneratedAt: '2026-04-22T12:00:00.000Z',
      generatedAt: '2026-04-22T12:00:00.000Z',
      resolvedHighlights: [],
      reviewItems: [buildReviewItem({
        id: "review-mojibake",
        explanation: brokenMessage,
        whyItMatters: brokenMessage,
        message: brokenMessage,
        issueType: 'review_copy',
      })],
    }

    render(
      <ResumeComparisonView
        originalCvState={buildCvState('Original summary')}
        optimizedCvState={buildCvState('Optimized summary')}
        generationType="JOB_TARGETING"
        sessionId="sess_mojibake"
        highlightState={highlightState}
        onContinue={vi.fn()}
      />,
    )

    expect(screen.getByTestId('override-review-panel')).toHaveTextContent(
      'Revise o currículo com atenção para evitar aproximação sem evidência.',
    )
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
