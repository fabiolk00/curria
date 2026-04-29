import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

import { ChatInterface } from "./chat-interface"
import { fingerprintJD } from "@/lib/agent/jd-fingerprint"

Element.prototype.scrollIntoView = vi.fn()

const {
  mockCreateChatCompletionStreamWithRetry,
  mockGetAiChatAccess,
  mockGetCurrentAppUser,
  mockAgentLimiterLimit,
  mockGetSession,
  mockCreateSessionWithCredit,
  mockGetMessages,
  mockAppendMessage,
  mockApplyToolPatchWithVersion,
  mockCheckUserQuota,
  mockIncrementMessageCount,
  mockUpdateSession,
  mockDispatchTool,
  mockDispatchToolWithContext,
  mockGetToolDefinitionsForPhase,
} = vi.hoisted(() => ({
  mockCreateChatCompletionStreamWithRetry: vi.fn(),
  mockGetAiChatAccess: vi.fn(),
  mockGetCurrentAppUser: vi.fn(),
  mockAgentLimiterLimit: vi.fn(),
  mockGetSession: vi.fn(),
  mockCreateSessionWithCredit: vi.fn(),
  mockGetMessages: vi.fn(),
  mockAppendMessage: vi.fn(),
  mockApplyToolPatchWithVersion: vi.fn(),
  mockCheckUserQuota: vi.fn(),
  mockIncrementMessageCount: vi.fn(),
  mockUpdateSession: vi.fn(),
  mockDispatchTool: vi.fn(),
  mockDispatchToolWithContext: vi.fn(),
  mockGetToolDefinitionsForPhase: vi.fn(() => []),
}))

const { mockUseUser } = vi.hoisted(() => ({
  mockUseUser: vi.fn(() => ({ user: { firstName: "Fabio" } })),
}))

vi.mock("@clerk/nextjs", () => ({
  useUser: mockUseUser,
}))

vi.mock("./chat-message", () => ({
  ChatMessage: ({
    role,
    content,
    toolStatus,
  }: {
    role: string
    content: string
    toolStatus?: string
  }) => (
    <div data-testid={`message-${role}`}>
      <div>{content}</div>
      {toolStatus ? <div data-testid="tool-status">{toolStatus}</div> : null}
    </div>
  ),
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/lib/openai/client", () => ({
  openai: {},
}))

vi.mock("@/lib/openai/chat", () => ({
  createChatCompletionStreamWithRetry: mockCreateChatCompletionStreamWithRetry,
}))

vi.mock("@/lib/auth/app-user", () => ({
  getCurrentAppUser: mockGetCurrentAppUser,
}))

vi.mock("@/lib/billing/ai-chat-access.server", () => ({
  getAiChatAccess: mockGetAiChatAccess,
}))

vi.mock("@/lib/rate-limit", () => ({
  agentLimiter: {
    limit: mockAgentLimiterLimit,
  },
}))

vi.mock("@/lib/db/sessions", () => ({
  getSession: mockGetSession,
  createSessionWithCredit: mockCreateSessionWithCredit,
  getMessages: mockGetMessages,
  appendMessage: mockAppendMessage,
  applyToolPatchWithVersion: mockApplyToolPatchWithVersion,
  checkUserQuota: mockCheckUserQuota,
  incrementMessageCount: mockIncrementMessageCount,
  updateSession: mockUpdateSession,
}))

vi.mock("@/lib/agent/context-builder", () => ({
  buildSystemPrompt: vi.fn(() => "system prompt"),
  trimMessages: vi.fn((messages: unknown) => messages),
}))

vi.mock("@/lib/agent/tools", () => ({
  TOOL_DEFINITIONS: [],
  dispatchTool: mockDispatchTool,
  dispatchToolWithContext: mockDispatchToolWithContext,
  getToolDefinitionsForPhase: mockGetToolDefinitionsForPhase,
}))

vi.mock("@/lib/agent/usage-tracker", () => ({
  trackApiUsage: vi.fn(),
  calculateUsageCostCents: vi.fn(() => 1),
}))

vi.mock("@/lib/agent/url-extractor", () => ({
  extractUrl: vi.fn(() => null),
}))

vi.mock("@/lib/agent/scraper", () => ({
  scrapeJobPosting: vi.fn(),
}))

vi.mock("@/lib/observability/structured-log", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  serializeError: vi.fn(() => ({})),
}))

type PersistedMessage = {
  role: "user" | "assistant"
  content: string
  createdAt: Date
}

function buildDialogSession(overrides?: {
  id?: string
  targetJobDescription?: string
}) {
  return {
    id: overrides?.id ?? "sess_dialog_route_stream",
    userId: "usr_123",
    stateVersion: 1,
    phase: "dialog" as const,
    cvState: {
      fullName: "Fabio Silva",
      email: "fabio@example.com",
      phone: "11999999999",
      summary: "Analista de dados com foco em BI e automacao.",
      experience: [],
      skills: ["SQL", "Power BI"],
      education: [],
    },
    agentState: {
      parseStatus: "parsed" as const,
      rewriteHistory: {},
      sourceResumeText: "Fabio Silva\nResumo\nExperiencia com Power BI, SQL e ETL.",
      targetJobDescription: overrides?.targetJobDescription,
    },
    generatedOutput: { status: "idle" as const },
    creditsUsed: 1,
    messageCount: 2,
    creditConsumed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

const pendingWeakFitCheckpoint = {
  status: "pending_confirmation" as const,
  targetJobDescription: "Senior Platform Engineer com foco em Kubernetes, Go e Terraform.",
  summary: "A vaga atual parece um match fraco para o seu histórico.",
  reasons: ["Skill ausente ou pouco evidenciada: Kubernetes"],
  nextSteps: ["Cancelar para revisar a vaga antes de gerar."],
  assessedAt: "2026-04-25T10:00:00.000Z",
}

async function* emptyStopStream() {
  yield {
    choices: [{
      delta: {},
      finish_reason: "stop",
    }],
    usage: null,
  }
}

function toBrowserSseResponse(response: Response, payload: string): Response {
  const encoder = new TextEncoder()

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(payload))
        controller.close()
      },
    }),
    {
      status: response.status,
      headers: response.headers,
    },
  )
}

async function loadRoute() {
  vi.resetModules()
  return import("../../app/api/agent/route")
}

describe("ChatInterface real /api/agent transcript integration", () => {
  let persistedMessages: PersistedMessage[]

  beforeEach(() => {
    vi.clearAllMocks()
    persistedMessages = []
    mockGetAiChatAccess.mockResolvedValue({
      allowed: true,
      feature: "ai_chat",
      reason: "active_pro",
      plan: "pro",
      status: "active",
      renewsAt: "2026-05-20T00:00:00.000Z",
      asaasSubscriptionId: "sub_123",
    })

    mockGetCurrentAppUser.mockResolvedValue({
      id: "usr_123",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: "identity_123",
        userId: "usr_123",
        provider: "clerk",
        providerSubject: "clerk_123",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: "cred_123",
        userId: "usr_123",
        creditsRemaining: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    mockAgentLimiterLimit.mockResolvedValue({
      success: true,
      limit: 15,
      remaining: 14,
      reset: 0,
      pending: Promise.resolve(),
    })

    mockGetMessages.mockImplementation(async () => persistedMessages)
    mockAppendMessage.mockImplementation(async (_sessionId: string, role: "user" | "assistant", content: string) => {
      persistedMessages.push({
        role,
        content,
        createdAt: new Date(),
      })
    })
    mockApplyToolPatchWithVersion.mockImplementation(async (session, patch) => {
      if (patch?.phase) {
        session.phase = patch.phase
      }

      if (patch?.cvState) {
        session.cvState = {
          ...session.cvState,
          ...patch.cvState,
        }
      }

      if (patch?.generatedOutput) {
        session.generatedOutput = {
          ...session.generatedOutput,
          ...patch.generatedOutput,
        }
      }

      if (patch?.agentState) {
        session.agentState = {
          ...session.agentState,
          ...patch.agentState,
          phaseMeta: patch.agentState.phaseMeta
            ? {
              ...session.agentState.phaseMeta,
              ...patch.agentState.phaseMeta,
            }
            : session.agentState.phaseMeta,
        }
      }
    })
    mockCheckUserQuota.mockResolvedValue(true)
    mockCreateSessionWithCredit.mockResolvedValue(null)
    mockIncrementMessageCount.mockResolvedValue(true)
    mockUpdateSession.mockResolvedValue(undefined)
    mockDispatchTool.mockReset()
    mockDispatchToolWithContext.mockReset()
    mockGetToolDefinitionsForPhase.mockReturnValue([])
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('renders the real route deterministic rewrite as one visible assistant turn for "reescreva"', async () => {
    const session = buildDialogSession({
      id: "sess_route_rewrite",
      targetJobDescription: "Analista de BI Senior com foco em Power BI, SQL e ETL.",
    })
    const { POST } = await loadRoute()
    mockGetSession.mockResolvedValue(session)
    mockDispatchToolWithContext.mockResolvedValueOnce({
      output: {
        success: true,
        rewritten_content: "Analista de BI com experiência em Power BI, SQL e ETL, focado em dashboards executivos e tradução de indicadores para o negócio.",
        section_data: "Analista de BI com experiência em Power BI, SQL e ETL, focado em dashboards executivos e tradução de indicadores para o negócio.",
        keywords_added: ["Power BI", "SQL", "ETL"],
        changes_made: ["Resumo alinhado a BI senior"],
      },
      outputJson: JSON.stringify({
        success: true,
        rewritten_content: "Analista de BI com experiência em Power BI, SQL e ETL, focado em dashboards executivos e tradução de indicadores para o negócio.",
        section_data: "Analista de BI com experiência em Power BI, SQL e ETL, focado em dashboards executivos e tradução de indicadores para o negócio.",
        keywords_added: ["Power BI", "SQL", "ETL"],
        changes_made: ["Resumo alinhado a BI senior"],
      }),
      persistedPatch: {
        cvState: {
          summary: "Analista de BI com experiência em Power BI, SQL e ETL, focado em dashboards executivos e tradução de indicadores para o negócio.",
        },
      },
    })
    const routeResponse = await POST(new NextRequest("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        message: "reescreva",
      }),
    }))
    const routePayload = await routeResponse.text()
    const routeHeaders = new Headers(routeResponse.headers)
    persistedMessages = []
    mockAppendMessage.mockClear()

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (typeof url === "string" && url === "/api/profile") {
        return new Response(JSON.stringify({ profile: { profilePhotoUrl: null } }), { status: 200 })
      }

      if (typeof url === "string" && url === `/api/session/${session.id}/messages`) {
        return new Response(
          JSON.stringify({
            messages: persistedMessages.map((message) => ({
              ...message,
              createdAt: message.createdAt.toISOString(),
            })),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      if (typeof url === "string" && url === `/api/session/${session.id}`) {
        return new Response(
          JSON.stringify({
            session: {
              phase: "dialog",
              messageCount: persistedMessages.length,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      if (typeof url === "string" && url === "/api/agent") {
        return toBrowserSseResponse(
          new Response(null, {
            status: routeResponse.status,
            headers: routeHeaders,
          }),
          routePayload,
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId={session.id} userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    fireEvent.change(textarea, { target: { value: "reescreva" } })
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" })

    await waitFor(() => {
      const assistantMessages = screen.getAllByTestId("message-assistant")
      expect(assistantMessages).toHaveLength(2)

      const finalAssistantMessage = assistantMessages[assistantMessages.length - 1]
      expect(finalAssistantMessage).toHaveTextContent("Aqui está uma versão reescrita do seu resumo profissional:")
      expect(finalAssistantMessage).toHaveTextContent("Analista de BI com experiência em Power BI, SQL e ETL")
      expect(finalAssistantMessage).toHaveTextContent('Aceito')
    })
  })

  it("renders the latest vacancy acknowledgement from the real route when dialog recovery falls back", async () => {
    const session = buildDialogSession({
      id: "sess_route_latest_vacancy",
      targetJobDescription: undefined,
    })
    const { POST } = await loadRoute()
    const jobDescription = [
      "Responsabilidades",
      "Construir dashboards executivos em Power BI e traduzir necessidades do negocio em indicadores.",
      "Requisitos",
      "SQL avançado, ETL, comunicação com áreas não técnicas e Power BI.",
      "Diferenciais",
      "Python, APIs e Microsoft Fabric.",
    ].join("\n")

    mockGetSession.mockResolvedValue(session)
    mockCreateChatCompletionStreamWithRetry.mockImplementation(
      async () => emptyStopStream() as never,
    )
    const routeResponse = await POST(new NextRequest("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        message: jobDescription,
      }),
    }))
    const routePayload = await routeResponse.text()
    const routeHeaders = new Headers(routeResponse.headers)
    persistedMessages = []
    mockAppendMessage.mockClear()

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (typeof url === "string" && url === "/api/profile") {
        return new Response(JSON.stringify({ profile: { profilePhotoUrl: null } }), { status: 200 })
      }

      if (typeof url === "string" && url === `/api/session/${session.id}/messages`) {
        return new Response(
          JSON.stringify({
            messages: persistedMessages.map((message) => ({
              ...message,
              createdAt: message.createdAt.toISOString(),
            })),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      if (typeof url === "string" && url === `/api/session/${session.id}`) {
        return new Response(
          JSON.stringify({
            session: {
              phase: "dialog",
              messageCount: persistedMessages.length,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      if (typeof url === "string" && url === "/api/agent") {
        return toBrowserSseResponse(
          new Response(null, {
            status: routeResponse.status,
            headers: routeHeaders,
          }),
          routePayload,
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId={session.id} userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    fireEvent.change(textarea, { target: { value: jobDescription } })
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" })

    await waitFor(() => {
      const assistantMessages = screen.getAllByTestId("message-assistant")
      expect(assistantMessages).toHaveLength(2)

      const finalAssistantMessage = assistantMessages[assistantMessages.length - 1]
      expect(finalAssistantMessage).toHaveTextContent("Recebi essa nova vaga")
      expect(finalAssistantMessage).toHaveTextContent("adaptar agora seu resumo")
      expect(finalAssistantMessage).not.toHaveTextContent(
        "Recebi a vaga e ela já ficou salva como referência para o seu currículo.",
      )
    })
  }, 10000)

  it('reaches real generation from the weak-fit modal continue action without a second manual Aceito', async () => {
    const session = {
      ...buildDialogSession({
        id: "sess_route_weak_fit_continue",
        targetJobDescription: "Senior Platform Engineer com foco em Kubernetes, Go e Terraform.",
      }),
      internalHeuristicAtsScore: {
        total: 54,
        breakdown: {
          format: 70,
          structure: 58,
          keywords: 45,
          contact: 95,
          impact: 30,
        },
        issues: [],
        suggestions: [],
      },
      agentState: {
        parseStatus: "parsed" as const,
        rewriteHistory: {},
        sourceResumeText: "Fabio Silva\nResumo\nExperiencia com Power BI, SQL e ETL.",
        targetJobDescription: "Senior Platform Engineer com foco em Kubernetes, Go e Terraform.",
        targetFitAssessment: {
          level: "weak" as const,
          summary: "O perfil atual parece pouco alinhado com a vaga-alvo neste momento.",
          reasons: ["Skill ausente ou pouco evidenciada: Kubernetes"],
          assessedAt: "2026-04-25T10:00:00.000Z",
        },
        careerFitEvaluation: {
          riskLevel: "high" as const,
          needsExplicitConfirmation: true,
          summary: "Desalinhamento estrutural para a vaga.",
          reasons: ["Skill ausente ou pouco evidenciada: Kubernetes"],
          riskPoints: 10,
          assessedAt: "2026-04-25T10:00:00.000Z",
          signals: {
            matchScore: 34,
            missingSkillsCount: 3,
            weakAreasCount: 2,
            familyDistance: "distant" as const,
            seniorityGapMajor: false,
          },
        },
        gapAnalysis: {
          result: {
            matchScore: 34,
            missingSkills: ["Kubernetes", "Go", "Terraform"],
            weakAreas: ["experience", "summary"],
            improvementSuggestions: ["Fortalecer projetos de infraestrutura antes de insistir nessa trilha."],
          },
          analyzedAt: "2026-04-25T10:00:00.000Z",
        },
        phaseMeta: {
          careerFitWarningIssuedAt: "2026-04-25T10:05:00.000Z",
          careerFitRiskLevelAtWarning: "high" as const,
          careerFitWarningJDFingerprint: fingerprintJD("Senior Platform Engineer com foco em Kubernetes, Go e Terraform."),
          careerFitWarningTargetJobDescription: "Senior Platform Engineer com foco em Kubernetes, Go e Terraform.",
        },
      },
    }

    const { POST } = await loadRoute()
    mockGetSession.mockResolvedValue(session)
    mockDispatchToolWithContext.mockImplementation(async (toolName) => {
      if (toolName === "set_phase") {
        return {
          output: { success: true, phase: "generation" },
          outputJson: JSON.stringify({ success: true, phase: "generation" }),
          persistedPatch: {
            phase: "generation",
          },
        }
      }

      if (toolName === "create_target_resume") {
        return {
          output: {
            success: true,
            targetId: "target_weak_fit",
            targetJobDescription: "Senior Platform Engineer com foco em Kubernetes, Go e Terraform.",
            derivedCvState: {
              ...session.cvState,
              summary: "Profissional de dados em transição para infraestrutura com estudos em Kubernetes, Go e Terraform.",
              skills: ["SQL", "Power BI", "Kubernetes", "Terraform"],
            },
          },
          outputJson: JSON.stringify({ success: true, targetId: "target_weak_fit" }),
          persistedPatch: {
            agentState: {
              targetJobDescription: "Senior Platform Engineer com foco em Kubernetes, Go e Terraform.",
            },
          },
        }
      }

      if (toolName === "generate_file") {
        return {
          output: {
            success: true,
            pdfUrl: "https://example.com/resume.pdf",
          },
          outputJson: JSON.stringify({ success: true, pdfUrl: "https://example.com/resume.pdf" }),
          persistedPatch: {
            generatedOutput: {
              status: "ready",
              pdfPath: "usr_123/sess_route_weak_fit_continue/resume.pdf",
            },
          },
        }
      }

      if (toolName === "score_ats") {
        return {
          output: {
            success: true,
            result: {
              total: 63,
              breakdown: {
                format: 70,
                structure: 65,
                keywords: 58,
                contact: 95,
                impact: 40,
              },
              issues: [],
              suggestions: [],
            },
          },
          outputJson: JSON.stringify({ success: true, result: { total: 63 } }),
          persistedPatch: {
            internalHeuristicAtsScore: {
              total: 63,
              breakdown: {
                format: 70,
                structure: 65,
                keywords: 58,
                contact: 95,
                impact: 40,
              },
              issues: [],
              suggestions: [],
            },
          },
        }
      }

      throw new Error(`Unexpected tool call: ${toolName}`)
    })

    const fakeInitialPayload = [
      { type: "patch", patch: { phase: "confirm" }, phase: "confirm" },
      { type: "text", content: 'Quando fizer sentido, clique em "Aceito" para gerar seu currículo.' },
      { type: "done", sessionId: session.id, phase: "confirm", messageCount: 3, careerFitCheckpoint: pendingWeakFitCheckpoint },
    ].map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")

    let agentCallCount = 0
    const agentBodies: Array<Record<string, unknown>> = []

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (typeof url === "string" && url === "/api/profile") {
        return new Response(JSON.stringify({ profile: { profilePhotoUrl: null } }), { status: 200 })
      }

      if (typeof url === "string" && url === `/api/session/${session.id}/messages`) {
        return new Response(
          JSON.stringify({
            messages: persistedMessages.map((message) => ({
              ...message,
              createdAt: message.createdAt.toISOString(),
            })),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      if (typeof url === "string" && url === `/api/session/${session.id}`) {
        return new Response(
          JSON.stringify({
            session: {
              phase: agentCallCount > 1 ? "generation" : "confirm",
              agentState: {
                careerFitCheckpoint: agentCallCount > 1 ? null : pendingWeakFitCheckpoint,
              },
              messageCount: agentCallCount > 1 ? 4 : 3,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      if (typeof url === "string" && url === "/api/agent") {
        agentCallCount += 1
        if (init?.body && typeof init.body === "string") {
          agentBodies.push(JSON.parse(init.body) as Record<string, unknown>)
        }

        if (agentCallCount === 1) {
          return toBrowserSseResponse(
            new Response(null, {
              status: 200,
              headers: { "Content-Type": "text/event-stream", "X-Session-Id": session.id },
            }),
            fakeInitialPayload,
          )
        }

        const routeResponse = await POST(new NextRequest("http://localhost/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: init?.body as BodyInit,
        }))
        const routePayload = await routeResponse.text()
        const routeHeaders = new Headers(routeResponse.headers)

        return toBrowserSseResponse(
          new Response(null, {
            status: routeResponse.status,
            headers: routeHeaders,
          }),
          routePayload,
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(
      <ChatInterface
        sessionId={session.id}
        userName="Fabio"
        weakFitCheckpoint={pendingWeakFitCheckpoint}
      />,
    )

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    fireEvent.change(textarea, { target: { value: "gere o arquivo" } })
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" })

    await waitFor(() => {
      expect(screen.getByTestId("chat-accept-generate")).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId("chat-accept-generate"))

    await waitFor(() => {
      expect(screen.getByTestId("weak-fit-confirmation-modal")).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId("weak-fit-continue"))

    await waitFor(() => {
      const assistantMessages = screen.getAllByTestId("message-assistant")
      expect(assistantMessages[assistantMessages.length - 1]).toHaveTextContent("Seu currículo ATS-otimizado em PDF está pronto.")
    }, { timeout: 5000 })

    expect(agentBodies[1]?.message).toBe("Continuar mesmo assim")
    expect(mockDispatchToolWithContext.mock.calls.some(([toolName, toolInput, toolSession]) => (
      toolName === "generate_file"
      && typeof toolInput === "object"
      && toolInput !== null
      && "cv_state" in (toolInput as Record<string, unknown>)
      && typeof toolSession === "object"
      && toolSession !== null
      && "id" in (toolSession as Record<string, unknown>)
      && (toolSession as { id?: string }).id === session.id
    ))).toBe(true)
  }, 10000)
})
