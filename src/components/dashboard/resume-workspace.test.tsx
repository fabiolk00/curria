import React from "react"

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PreviewPanelProvider } from "@/context/preview-panel-context"
import { NEW_CONVERSATION_EVENT } from "./events"
import { ResumeWorkspace } from "./resume-workspace"

const {
  mockGetBillingSummary,
  mockGetSessionWorkspace,
  mockGenerateResume,
  mockIsGeneratedOutputReady,
  mockOverrideJobTargetingValidation,
  mockTrackAnalyticsEvent,
} = vi.hoisted(() => ({
  mockGetBillingSummary: vi.fn(),
  mockGetSessionWorkspace: vi.fn(),
  mockGenerateResume: vi.fn(),
  mockIsGeneratedOutputReady: vi.fn(),
  mockOverrideJobTargetingValidation: vi.fn(),
  mockTrackAnalyticsEvent: vi.fn(),
}))

vi.mock("@/lib/dashboard/workspace-client", () => ({
  getBillingSummary: mockGetBillingSummary,
  getSessionWorkspace: mockGetSessionWorkspace,
  isGeneratedOutputReady: mockIsGeneratedOutputReady,
  generateResume: mockGenerateResume,
  overrideJobTargetingValidation: mockOverrideJobTargetingValidation,
  isInsufficientCreditsError: (error: unknown) => {
    return Boolean(
      error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: string }).code === "INSUFFICIENT_CREDITS",
    )
  },
  getDownloadUrls: vi.fn().mockResolvedValue({ docxUrl: null, pdfUrl: null }),
  manualEditBaseSection: vi.fn(),
}))

vi.mock("@/components/analytics/track-event", () => ({
  trackAnalyticsEvent: (...args: unknown[]) => mockTrackAnalyticsEvent(...args),
}))

vi.mock("./chat-interface", () => ({
  ChatInterface: ({
    onCreditsExhausted,
    onSessionChange,
    onAgentTurnCompleted,
    currentCredits,
    sessionId,
    weakFitCheckpoint,
  }: {
    onCreditsExhausted?: () => void
    onSessionChange?: (sessionId: string) => void
    onAgentTurnCompleted?: (payload: {
      sessionId: string
      isNewSession: boolean
      phase: string
    }) => void
    currentCredits?: number
    sessionId?: string
    weakFitCheckpoint?: {
      status: string
      summary: string
    } | null
  }) => (
    <>
      <button type="button" onClick={() => onCreditsExhausted?.()}>
        Trigger credits exhausted
      </button>
      <button type="button" onClick={() => onSessionChange?.("sess_new_from_agent")}>
        Simulate new session
      </button>
      <button
        type="button"
        onClick={() => onAgentTurnCompleted?.({
          sessionId: "sess_new_from_agent",
          isNewSession: true,
          phase: "intake",
        })}
      >
        Simulate new session done
      </button>
      <div data-testid="chat-session-id">{sessionId ?? "none"}</div>
      <div data-testid="chat-current-credits">{currentCredits ?? 0}</div>
      <div data-testid="chat-weak-fit-checkpoint">{weakFitCheckpoint?.summary ?? "none"}</div>
    </>
  ),
}))

vi.mock("./plan-update-dialog", () => ({
  PlanUpdateDialog: ({ isOpen, currentCredits }: { isOpen: boolean; currentCredits: number }) => (
    <div
      data-testid="plan-update-dialog"
      data-open={String(isOpen)}
      data-credits={String(currentCredits)}
    />
  ),
}))

vi.mock("./manual-edit-dialog", () => ({
  ManualEditDialog: () => null,
}))

vi.mock("@/components/ats-score-badge", () => ({
  default: () => null,
}))

vi.mock("@/components/phase-badge", () => ({
  default: () => null,
}))

vi.mock("@/components/ui/spinner", () => ({
  Spinner: () => <span data-testid="spinner" />,
}))

function buildWorkspace() {
  return {
    session: {
      id: "sess_workspace",
      phase: "intake",
      stateVersion: 1,
      generatedOutput: { status: "ready" },
      atsScore: null,
      messageCount: 1,
      creditConsumed: false,
      createdAt: "2026-04-15T00:00:00.000Z",
      updatedAt: "2026-04-15T00:00:00.000Z",
      agentState: {
        gapAnalysis: null,
        rewriteStatus: "completed",
        rewriteValidation: {
          valid: true,
          issues: [],
        },
      },
      cvState: {
        fullName: "Fabio Silva",
        email: "fabio@example.com",
        phone: "11999999999",
        linkedin: "linkedin.com/in/fabio",
        location: "Sao Paulo",
        summary: "Resumo",
        skills: [],
        experience: [],
        education: [],
        certifications: [],
      },
    },
    jobs: [],
    targets: [],
  }
}

function buildArtifactJob(overrides: Record<string, unknown> = {}) {
  return {
    jobId: "job_async_generation",
    userId: "usr_123",
    sessionId: "sess_workspace",
    idempotencyKey: "job-key",
    type: "artifact_generation",
    status: "running",
    stage: "processing",
    dispatchInputRef: {
      kind: "session_cv_state",
      sessionId: "sess_workspace",
      snapshotSource: "optimized",
    },
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
    ...overrides,
  }
}

function renderWorkspace(ui: React.ReactElement) {
  return render(
    <PreviewPanelProvider>
      {ui}
    </PreviewPanelProvider>,
  )
}

describe("ResumeWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetBillingSummary.mockReset()
    mockOverrideJobTargetingValidation.mockReset()
    mockTrackAnalyticsEvent.mockReset()
    mockIsGeneratedOutputReady.mockReturnValue(true)
    mockGetSessionWorkspace.mockResolvedValue(buildWorkspace())
    mockGenerateResume.mockResolvedValue({
      success: true,
      scope: "base",
      creditsUsed: 0,
      generationType: "ATS_ENHANCEMENT",
      jobId: "job_default",
    })
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it("syncs sessionId to URL via replaceState when session changes", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState")

    renderWorkspace(<ResumeWorkspace initialSessionId={undefined} userName="Fabio" />)

    await userEvent.click(screen.getByRole("button", { name: /^simulate new session$/i }))

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalled()
    })

    const lastCall = replaceStateSpy.mock.calls[replaceStateSpy.mock.calls.length - 1]
    const updatedUrl = lastCall[2] as string
    expect(updatedUrl).toContain("session=sess_new_from_agent")

    replaceStateSpy.mockRestore()
  })

  it("does not call replaceState when the URL already has the same session param", async () => {
    // Set the current URL to already include the session param (same origin)
    const base = new URL(window.location.href)
    base.searchParams.set("session", "sess_existing")
    window.history.replaceState({}, "", base.toString())

    const replaceStateSpy = vi.spyOn(window.history, "replaceState")

    renderWorkspace(<ResumeWorkspace initialSessionId="sess_existing" userName="Fabio" />)

    // Wait for initial effects to settle
    await waitFor(() => {
      expect(mockGetSessionWorkspace).toHaveBeenCalledWith("sess_existing")
    })

    // replaceState should not have been called since URL already matches
    expect(replaceStateSpy).not.toHaveBeenCalled()

    replaceStateSpy.mockRestore()
    // Clean up URL
    const clean = new URL(window.location.href)
    clean.searchParams.delete("session")
    window.history.replaceState({}, "", clean.toString())
  })

  it("opens the plan update modal when the chat reports exhausted credits", async () => {
    renderWorkspace(<ResumeWorkspace initialSessionId="sess_123" userName="Fabio" />)

    await waitFor(() => {
      expect(mockGetSessionWorkspace).toHaveBeenCalledWith("sess_123")
    })

    expect(screen.getByTestId("resume-workspace")).toHaveAttribute("data-session-id", "sess_123")
    expect(screen.getByTestId("resume-workspace")).toHaveAttribute("data-target-count", "0")
    expect(screen.getByTestId("resume-workspace")).toHaveAttribute("data-base-output-ready", "true")

    expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-open", "false")

    await userEvent.click(screen.getByRole("button", { name: /trigger credits exhausted/i }))

    await waitFor(() => {
      expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-open", "true")
    })
  })

  it("shows a Pro-only lock state and skips workspace fetches when chat access is blocked", async () => {
    renderWorkspace(
      <ResumeWorkspace
        canAccessAiChat={false}
        aiChatAccessTitle="Chat com IA exclusivo do plano PRO"
        aiChatAccessMessage="Este recurso está disponível apenas para usuários do plano PRO. Faça upgrade para acessar o chat com IA."
        aiChatUpgradeUrl="/finalizar-compra?plan=pro"
        initialSessionId="sess_blocked"
        userName="Fabio"
      />,
    )

    expect(mockGetSessionWorkspace).not.toHaveBeenCalled()
    expect(screen.getByTestId("resume-workspace")).toHaveAttribute("data-session-id", "")
    expect(screen.getByTestId("resume-workspace")).toHaveAttribute("data-busy", "false")
    expect(screen.getByTestId("ai-chat-access-card")).toBeInTheDocument()
    expect(screen.getByText("Chat com IA exclusivo do plano PRO")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /fazer upgrade/i })).toHaveAttribute("href", "/finalizar-compra?plan=pro")
  })

  it("passes the snapshot-derived weak-fit checkpoint down to ChatInterface", async () => {
    mockGetSessionWorkspace.mockResolvedValue({
      ...buildWorkspace(),
      session: {
        ...buildWorkspace().session,
        agentState: {
          ...buildWorkspace().session.agentState,
          careerFitCheckpoint: {
            status: "pending_confirmation",
            targetJobDescription: "Senior Platform Engineer",
            summary: "A vaga atual parece um match fraco para o seu histórico.",
            reasons: ["Skill ausente ou pouco evidenciada: Kubernetes"],
            nextSteps: ["Cancelar para revisar a vaga."],
            assessedAt: "2026-04-25T10:00:00.000Z",
          },
        },
      },
    })

    renderWorkspace(<ResumeWorkspace initialSessionId="sess_123" userName="Fabio" />)

    await waitFor(() => {
      expect(mockGetSessionWorkspace).toHaveBeenCalledWith("sess_123")
    })

    expect(screen.getByTestId("chat-weak-fit-checkpoint")).toHaveTextContent(
      "A vaga atual parece um match fraco para o seu histórico.",
    )
  })

  it("keeps local credits unchanged after creating a free new session", async () => {
    renderWorkspace(
      <ResumeWorkspace
        initialSessionId={undefined}
        userName="Fabio"
        currentCredits={1}
      />,
    )

    expect(screen.getByTestId("chat-current-credits")).toHaveTextContent("1")
    expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-credits", "1")

    await userEvent.click(screen.getByRole("button", { name: /simulate new session done/i }))

    await waitFor(() => {
      expect(screen.getByTestId("chat-current-credits")).toHaveTextContent("1")
    })

    expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-credits", "1")
  })

  it("keeps a durable generate acknowledgement in progress until the same job reaches a terminal state", async () => {
    vi.useFakeTimers()
    try {
      mockIsGeneratedOutputReady.mockImplementation(
        (generatedOutput) => generatedOutput?.status === "ready" && Boolean(generatedOutput?.pdfPath),
      )
      mockGenerateResume.mockResolvedValue({
        success: true,
        scope: "base",
        creditsUsed: 0,
        generationType: "ATS_ENHANCEMENT",
        jobId: "job_async_generation",
        inProgress: true,
      })
      mockGetSessionWorkspace
        .mockResolvedValueOnce({
          ...buildWorkspace(),
          session: {
            ...buildWorkspace().session,
            generatedOutput: { status: "idle" },
          },
        })
        .mockResolvedValueOnce({
          ...buildWorkspace(),
          session: {
            ...buildWorkspace().session,
            generatedOutput: { status: "generating" },
          },
          jobs: [
            buildArtifactJob({
              status: "running",
              stage: "processing",
            }),
          ],
        })
        .mockResolvedValueOnce({
          ...buildWorkspace(),
          session: {
            ...buildWorkspace().session,
            generatedOutput: {
              status: "ready",
              pdfPath: "artifacts/base.pdf",
            },
          },
          jobs: [
            buildArtifactJob({
              status: "completed",
              stage: "completed",
            }),
          ],
        })

      renderWorkspace(<ResumeWorkspace initialSessionId="sess_workspace" userName="Fabio" />)

      await act(async () => {
        await Promise.resolve()
      })

      expect(mockGetSessionWorkspace).toHaveBeenCalledWith("sess_workspace")

      fireEvent.click(screen.getByRole("button", { name: /gerar arquivo base/i }))

      await act(async () => {
        await Promise.resolve()
      })

      expect(mockGenerateResume).toHaveBeenCalledWith(
        "sess_workspace",
        { scope: "base" },
        expect.any(String),
      )
      expect(
        screen.getByText("Geracao em andamento. Atualizaremos os arquivos quando estiver pronto."),
      ).toBeInTheDocument()
      expect(screen.getByTestId("resume-workspace")).toHaveAttribute(
        "data-active-generation-job-id",
        "job_async_generation",
      )
      expect(screen.getByTestId("resume-workspace")).toHaveAttribute(
        "data-active-generation-status",
        "running",
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500)
        await Promise.resolve()
      })

      expect(screen.getByText("Arquivos da base gerados com sucesso.")).toBeInTheDocument()
      expect(screen.getByTestId("resume-workspace")).toHaveAttribute(
        "data-active-generation-job-id",
        "",
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it("clears the active session immediately when a new conversation starts", async () => {
    renderWorkspace(<ResumeWorkspace initialSessionId="sess_existing" userName="Fabio" />)

    await waitFor(() => {
      expect(mockGetSessionWorkspace).toHaveBeenCalledWith("sess_existing")
      expect(screen.getByTestId("chat-session-id")).toHaveTextContent("sess_existing")
    })

    expect(screen.getByTestId("resume-workspace")).toHaveAttribute("data-session-id", "sess_existing")

    act(() => {
      window.dispatchEvent(new Event(NEW_CONVERSATION_EVENT))
    })

    await waitFor(() => {
      expect(screen.getByTestId("chat-session-id")).toHaveTextContent("none")
    })

    expect(screen.getByTestId("resume-workspace")).toHaveAttribute("data-session-id", "")
  })

  it("opens a blocking modal when rewrite validation fails", async () => {
    mockGetSessionWorkspace.mockResolvedValue({
      ...buildWorkspace(),
      session: {
        ...buildWorkspace().session,
        id: "sess_failed_validation",
        updatedAt: "2026-04-15T22:35:57.744Z",
        agentState: {
          ...buildWorkspace().session.agentState,
          workflowMode: "job_targeting",
          rewriteStatus: "failed",
          rewriteValidation: {
            valid: false,
            issues: [{
              severity: "medium",
              section: "skills",
              message: "A lista de skills otimizada introduziu habilidade ou ferramenta sem base no currículo original.",
            }],
          },
          targetingPlan: {
            targetRole: "Analista de BI",
            targetRoleConfidence: "high",
            focusKeywords: ["sql", "power bi"],
            mustEmphasize: [],
            shouldDeemphasize: [],
            missingButCannotInvent: [],
            sectionStrategy: {
              summary: [],
              experience: [],
              skills: [],
              education: [],
              certifications: [],
            },
          },
        },
      },
    })

    renderWorkspace(<ResumeWorkspace initialSessionId="sess_failed_validation" userName="Fabio" />)

    expect(await screen.findByText("Não concluímos essa adaptação automaticamente")).toBeInTheDocument()
    expect(screen.getByText("O que bloqueou automaticamente")).toBeInTheDocument()
    expect(screen.getByText(/A lista de skills otimizada introduziu habilidade ou ferramenta sem base no currículo original\./)).toBeInTheDocument()
    expect(screen.getByText("Como interpretar esse aviso")).toBeInTheDocument()
  })

  it("uses ATS-specific modal copy when ats_enhancement validation fails", async () => {
    mockGetSessionWorkspace.mockResolvedValue({
      ...buildWorkspace(),
      session: {
        ...buildWorkspace().session,
        id: "sess_failed_ats_validation",
        updatedAt: "2026-04-15T22:59:45.604Z",
        agentState: {
          ...buildWorkspace().session.agentState,
          workflowMode: "ats_enhancement",
          rewriteStatus: "failed",
          rewriteValidation: {
            valid: false,
            issues: [{
              severity: "medium",
              section: "summary",
              message: "O resumo otimizado adicionou claim numérico sem suporte no currículo original.",
            }],
          },
        },
      },
    })

    renderWorkspace(<ResumeWorkspace initialSessionId="sess_failed_ats_validation" userName="Fabio" />)

    expect(await screen.findByText("Não concluímos essa melhoria ATS automaticamente")).toBeInTheDocument()
    expect(screen.getByText(/interrompemos a melhoria ATS/)).toBeInTheDocument()
    expect(screen.getByText(/impeditivo factual na reescrita ATS/)).toBeInTheDocument()
  })

  it("highlights a possible parsing bug when targetRole looks like a section heading", async () => {
    mockGetSessionWorkspace.mockResolvedValue({
      ...buildWorkspace(),
      session: {
        ...buildWorkspace().session,
        id: "sess_failed_heading_role",
        updatedAt: "2026-04-15T22:35:57.744Z",
        agentState: {
          ...buildWorkspace().session.agentState,
          workflowMode: "job_targeting",
          rewriteStatus: "failed",
          rewriteValidation: {
            valid: false,
            issues: [{
              severity: "medium",
              section: "skills",
              message: "A lista de skills otimizada introduziu habilidade ou ferramenta sem base no currículo original.",
            }],
          },
          targetingPlan: {
            targetRole: "Responsabilidades E Atribuições",
            targetRoleConfidence: "high",
            focusKeywords: ["sql"],
            mustEmphasize: [],
            shouldDeemphasize: [],
            missingButCannotInvent: [],
            sectionStrategy: {
              summary: [],
              experience: [],
              skills: [],
              education: [],
              certifications: [],
            },
          },
        },
      },
    })

    renderWorkspace(<ResumeWorkspace initialSessionId="sess_failed_heading_role" userName="Fabio" />)

    expect(await screen.findByText("Possível bug de leitura da vaga")).toBeInTheDocument()
    expect(screen.getByText(/Responsabilidades E Atribuições/)).toBeInTheDocument()
  })
  it("uses override generation when the recoverable modal has enough credits", async () => {
    mockOverrideJobTargetingValidation.mockResolvedValue({
      success: true,
      sessionId: "sess_recoverable_override",
      creditsUsed: 1,
      resumeGenerationId: "gen_workspace_override",
      generationType: "JOB_TARGETING",
    })
    mockGetSessionWorkspace.mockResolvedValue({
      ...buildWorkspace(),
      session: {
        ...buildWorkspace().session,
        id: "sess_recoverable_override",
        updatedAt: "2026-04-27T16:00:00.000Z",
        agentState: {
          ...buildWorkspace().session.agentState,
          workflowMode: "job_targeting",
          rewriteStatus: "failed",
          rewriteValidation: {
            blocked: true,
            valid: false,
            hardIssues: [{
              severity: "high",
              section: "summary",
              issueType: "target_role_overclaim",
              message: "O resumo assumiu o cargo alvo diretamente.",
            }],
            softWarnings: [],
            issues: [{
              severity: "high",
              section: "summary",
              issueType: "target_role_overclaim",
              message: "O resumo assumiu o cargo alvo diretamente.",
            }],
          },
          recoverableValidationBlock: {
            status: "validation_blocked_recoverable",
            overrideToken: "workspace_override_token",
            expiresAt: "2099-04-27T16:30:00.000Z",
            modal: {
              title: "Encontramos pontos que podem exagerar sua experiência",
              description: "A adaptação para esta vaga ficou mais agressiva do que o seu currículo original comprova.",
              primaryProblem: "O resumo tentou assumir diretamente o cargo alvo.",
              problemBullets: ["A versão pode ter declarado requisitos da vaga como experiência direta."],
              reassurance: "Você ainda pode gerar o currículo, mas recomendamos revisar.",
              actions: {
                secondary: { label: "Fechar", action: "close" },
                primary: {
                  label: "Gerar mesmo assim (1 crédito)",
                  action: "override_generate",
                  creditCost: 1,
                },
              },
            },
          },
        },
      },
    })

    renderWorkspace(
      <ResumeWorkspace
        initialSessionId="sess_recoverable_override"
        userName="Fabio"
        currentCredits={1}
      />,
    )

    const overrideButton = await screen.findByRole("button", { name: "Gerar mesmo assim (1 crédito)" })
    expect(screen.getByText("Você usará 1 crédito para gerar esta versão.")).toBeInTheDocument()

    await userEvent.click(overrideButton)

    await waitFor(() => {
      expect(mockOverrideJobTargetingValidation).toHaveBeenCalledWith("sess_recoverable_override", {
        overrideToken: "workspace_override_token",
        consumeCredit: true,
      })
    })
    expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-open", "false")
  })

  it("opens pricing instead of override when recoverable modal has no credits", async () => {
    mockGetSessionWorkspace.mockResolvedValue({
      ...buildWorkspace(),
      session: {
        ...buildWorkspace().session,
        id: "sess_recoverable_pricing",
        updatedAt: "2026-04-27T16:00:00.000Z",
        agentState: {
          ...buildWorkspace().session.agentState,
          workflowMode: "job_targeting",
          rewriteStatus: "failed",
          rewriteValidation: {
            blocked: true,
            valid: false,
            hardIssues: [{
              severity: "high",
              section: "summary",
              issueType: "target_role_overclaim",
              message: "O resumo assumiu o cargo alvo diretamente.",
            }],
            softWarnings: [],
            issues: [{
              severity: "high",
              section: "summary",
              issueType: "target_role_overclaim",
              message: "O resumo assumiu o cargo alvo diretamente.",
            }],
          },
          recoverableValidationBlock: {
            status: "validation_blocked_recoverable",
            overrideToken: "workspace_pricing_token",
            expiresAt: "2099-04-27T16:30:00.000Z",
            modal: {
              title: "Encontramos pontos que podem exagerar sua experiência",
              description: "A adaptação para esta vaga ficou mais agressiva do que o seu currículo original comprova.",
              primaryProblem: "O resumo tentou assumir diretamente o cargo alvo.",
              problemBullets: ["A versão pode ter declarado requisitos da vaga como experiência direta."],
              reassurance: "Você ainda pode gerar o currículo, mas recomendamos revisar.",
              actions: {
                secondary: { label: "Fechar", action: "close" },
                primary: {
                  label: "Gerar mesmo assim (1 crédito)",
                  action: "override_generate",
                  creditCost: 1,
                },
              },
            },
          },
        },
      },
    })

    renderWorkspace(
      <ResumeWorkspace
        initialSessionId="sess_recoverable_pricing"
        userName="Fabio"
        currentCredits={0}
      />,
    )

    const pricingButton = await screen.findByRole("button", { name: "Adicionar créditos" })
    expect(screen.getByText("Você precisa de 1 crédito para gerar esta versão.")).toBeInTheDocument()

    await userEvent.click(pricingButton)

    expect(mockOverrideJobTargetingValidation).not.toHaveBeenCalled()
    expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-open", "true")
  })

  it("updates the recoverable workspace CTA after credits are added without requesting a new targeting run", async () => {
    mockOverrideJobTargetingValidation.mockResolvedValue({
      success: true,
      sessionId: "sess_recoverable_credit_refresh",
      creditsUsed: 1,
      resumeGenerationId: "gen_workspace_credit_refresh",
      generationType: "JOB_TARGETING",
    })
    mockGetBillingSummary.mockResolvedValue({
      currentCredits: 1,
      currentPlan: "plus",
      activeRecurringPlan: null,
    })
    mockGetSessionWorkspace.mockResolvedValue({
      ...buildWorkspace(),
      session: {
        ...buildWorkspace().session,
        id: "sess_recoverable_credit_refresh",
        updatedAt: "2026-04-27T16:00:00.000Z",
        agentState: {
          ...buildWorkspace().session.agentState,
          workflowMode: "job_targeting",
          rewriteStatus: "failed",
          rewriteValidation: {
            blocked: true,
            valid: false,
            hardIssues: [{
              severity: "high",
              section: "summary",
              issueType: "target_role_overclaim",
              message: "O resumo assumiu o cargo alvo diretamente.",
            }],
            softWarnings: [],
            issues: [{
              severity: "high",
              section: "summary",
              issueType: "target_role_overclaim",
              message: "O resumo assumiu o cargo alvo diretamente.",
            }],
          },
          recoverableValidationBlock: {
            status: "validation_blocked_recoverable",
            overrideToken: "workspace_credit_refresh_token",
            expiresAt: "2099-04-27T16:30:00.000Z",
            modal: {
              title: "Encontramos pontos que podem exagerar sua experiência",
              description: "A adaptação para esta vaga ficou mais agressiva do que o seu currículo original comprova.",
              primaryProblem: "O resumo tentou assumir diretamente o cargo alvo.",
              problemBullets: ["A versão pode ter declarado requisitos da vaga como experiência direta."],
              reassurance: "Você ainda pode gerar o currículo, mas recomendamos revisar.",
              actions: {
                secondary: { label: "Fechar", action: "close" },
                primary: {
                  label: "Gerar mesmo assim (1 crédito)",
                  action: "override_generate",
                  creditCost: 1,
                },
              },
            },
          },
        },
      },
    })

    renderWorkspace(
      <ResumeWorkspace
        initialSessionId="sess_recoverable_credit_refresh"
        userName="Fabio"
        currentCredits={0}
      />,
    )

    expect(await screen.findByRole("button", { name: "Adicionar créditos" })).toBeInTheDocument()

    window.dispatchEvent(new Event("focus"))

    const overrideButton = await screen.findByRole("button", { name: "Gerar mesmo assim (1 crédito)" })
    expect(screen.getByText("Você usará 1 crédito para gerar esta versão.")).toBeInTheDocument()

    await userEvent.click(overrideButton)

    await waitFor(() => {
      expect(mockOverrideJobTargetingValidation).toHaveBeenCalledWith("sess_recoverable_credit_refresh", {
        overrideToken: "workspace_credit_refresh_token",
        consumeCredit: true,
      })
    })
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      "agent.job_targeting.validation_override_credit_added",
      expect.objectContaining({
        source: "workspace",
        availableCredits: 1,
      }),
    )
    expect(mockGenerateResume).not.toHaveBeenCalled()
  })

  it("renders the low-fit workspace modal with human copy and without internal terms", async () => {
    mockGetSessionWorkspace.mockResolvedValue({
      ...buildWorkspace(),
      session: {
        ...buildWorkspace().session,
        id: "sess_low_fit_workspace",
        updatedAt: "2026-04-27T16:00:00.000Z",
        agentState: {
          ...buildWorkspace().session.agentState,
          workflowMode: "job_targeting",
          rewriteStatus: "failed",
          rewriteValidation: {
            blocked: true,
            valid: false,
            recoverable: true,
            hardIssues: [{
              severity: "high",
              section: "summary",
              issueType: "low_fit_target_role",
              message: "A vaga ficou distante demais do histórico comprovado no currículo original.",
            }],
            softWarnings: [],
            issues: [{
              severity: "high",
              section: "summary",
              issueType: "low_fit_target_role",
              message: "A vaga ficou distante demais do histórico comprovado no currículo original.",
            }],
          },
          recoverableValidationBlock: {
            status: "validation_blocked_recoverable",
            overrideToken: "workspace_low_fit_token",
            expiresAt: "2099-04-27T16:30:00.000Z",
            modal: {
              title: "Esta vaga parece muito distante do seu currículo atual",
              description: "Encontramos poucos pontos comprovados no seu currículo para os requisitos principais desta vaga.",
              primaryProblem: "A vaga pede Java, Spring Boot, JPA/Hibernate, mensageria, Docker, CI/CD e microsserviços.",
              problemBullets: [
                "Seu currículo comprova melhor experiência em BI, Engenharia de Dados, SQL, Python, Power BI, Qlik, APIs e modelagem de dados.",
                "Encontramos alguns pontos próximos, como Git, APIs REST, bancos relacionais e integrações, mas eles não sustentam uma apresentação direta como Desenvolvedor Java.",
              ],
              reassurance: "Isso não significa que você não pode se candidatar.",
              recommendation: "Você pode gerar mesmo assim e revisar manualmente.",
              actions: {
                secondary: { label: "Fechar", action: "close" },
                primary: {
                  label: "Gerar mesmo assim (1 crédito)",
                  action: "override_generate",
                  creditCost: 1,
                },
              },
            },
          },
        },
      },
    })

    renderWorkspace(
      <ResumeWorkspace
        initialSessionId="sess_low_fit_workspace"
        userName="Fabio"
        currentCredits={1}
      />,
    )

    expect(await screen.findByText("Esta vaga parece muito distante do seu currículo atual")).toBeInTheDocument()
    expect(screen.getByText(/Encontramos poucos pontos comprovados/i)).toBeInTheDocument()
    expect(screen.getByText(/Java, Spring Boot, JPA\/Hibernate, mensageria, Docker, CI\/CD e microsserviços/i)).toBeInTheDocument()
    expect(screen.getByText(/Git, APIs REST, bancos relacionais e integrações/i)).toBeInTheDocument()
    expect(screen.queryByText(/unsupported_gap|targetEvidence|lowFitGate|hardIssue|softWarning|pipeline|recoverableValidationBlock/i)).not.toBeInTheDocument()
  })

  it("opens pricing when override fallback returns insufficient credits", async () => {
    mockOverrideJobTargetingValidation.mockRejectedValue({
      code: "INSUFFICIENT_CREDITS",
      message: "Você não tem créditos suficientes para gerar esta versão.",
      openPricing: true,
    })
    mockGetSessionWorkspace.mockResolvedValue({
      ...buildWorkspace(),
      session: {
        ...buildWorkspace().session,
        id: "sess_recoverable_backend_pricing",
        updatedAt: "2026-04-27T16:00:00.000Z",
        agentState: {
          ...buildWorkspace().session.agentState,
          workflowMode: "job_targeting",
          rewriteStatus: "failed",
          rewriteValidation: {
            blocked: true,
            valid: false,
            hardIssues: [{
              severity: "high",
              section: "summary",
              issueType: "target_role_overclaim",
              message: "O resumo assumiu o cargo alvo diretamente.",
            }],
            softWarnings: [],
            issues: [{
              severity: "high",
              section: "summary",
              issueType: "target_role_overclaim",
              message: "O resumo assumiu o cargo alvo diretamente.",
            }],
          },
          recoverableValidationBlock: {
            status: "validation_blocked_recoverable",
            overrideToken: "workspace_backend_pricing_token",
            expiresAt: "2099-04-27T16:30:00.000Z",
            modal: {
              title: "Encontramos pontos que podem exagerar sua experiência",
              description: "A adaptação para esta vaga ficou mais agressiva do que o seu currículo original comprova.",
              primaryProblem: "O resumo tentou assumir diretamente o cargo alvo.",
              problemBullets: ["A versão pode ter declarado requisitos da vaga como experiência direta."],
              reassurance: "Você ainda pode gerar o currículo, mas recomendamos revisar.",
              actions: {
                secondary: { label: "Fechar", action: "close" },
                primary: {
                  label: "Gerar mesmo assim (1 crédito)",
                  action: "override_generate",
                  creditCost: 1,
                },
              },
            },
          },
        },
      },
    })

    renderWorkspace(
      <ResumeWorkspace
        initialSessionId="sess_recoverable_backend_pricing"
        userName="Fabio"
        currentCredits={1}
      />,
    )

    await userEvent.click(await screen.findByRole("button", { name: "Gerar mesmo assim (1 crédito)" }))

    await waitFor(() => {
      expect(screen.getByTestId("plan-update-dialog")).toHaveAttribute("data-open", "true")
    })
  })

  it("highlights a possible parsing bug when targetRole confidence is low", async () => {
    mockGetSessionWorkspace.mockResolvedValue({
      ...buildWorkspace(),
      session: {
        ...buildWorkspace().session,
        id: "sess_failed_low_confidence_role",
        updatedAt: "2026-04-15T23:16:39.170Z",
        agentState: {
          ...buildWorkspace().session.agentState,
          workflowMode: "job_targeting",
          rewriteStatus: "failed",
          rewriteValidation: {
            valid: false,
            issues: [{
              severity: "medium",
              section: "skills",
              message: "A lista de skills otimizada introduziu habilidade ou ferramenta sem base no currículo original.",
            }],
          },
          targetingPlan: {
            targetRole: "Vaga Alvo",
            targetRoleConfidence: "low",
            focusKeywords: ["power bi", "sql"],
            mustEmphasize: [],
            shouldDeemphasize: [],
            missingButCannotInvent: [],
            sectionStrategy: {
              summary: [],
              experience: [],
              skills: [],
              education: [],
              certifications: [],
            },
          },
        },
      },
    })

    renderWorkspace(<ResumeWorkspace initialSessionId="sess_failed_low_confidence_role" userName="Fabio" />)

    expect(await screen.findByText(/bug de leitura da vaga/i)).toBeInTheDocument()
    expect(screen.getByText(/não conseguimos identificar com confiança o cargo-alvo/i)).toBeInTheDocument()
    expect(screen.queryByText("Vaga Alvo")).not.toBeInTheDocument()
  })
})
