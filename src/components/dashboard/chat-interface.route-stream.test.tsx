import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

import { ChatInterface } from "./chat-interface"

Element.prototype.scrollIntoView = vi.fn()

const {
  mockCreateChatCompletionStreamWithRetry,
  mockGetCurrentAppUser,
  mockAgentLimiterLimit,
  mockGetSession,
  mockCreateSessionWithCredit,
  mockGetMessages,
  mockAppendMessage,
  mockCheckUserQuota,
  mockIncrementMessageCount,
  mockUpdateSession,
  mockDispatchTool,
  mockDispatchToolWithContext,
  mockGetToolDefinitionsForPhase,
} = vi.hoisted(() => ({
  mockCreateChatCompletionStreamWithRetry: vi.fn(),
  mockGetCurrentAppUser: vi.fn(),
  mockAgentLimiterLimit: vi.fn(),
  mockGetSession: vi.fn(),
  mockCreateSessionWithCredit: vi.fn(),
  mockGetMessages: vi.fn(),
  mockAppendMessage: vi.fn(),
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

  it('renders the real route rewrite fallback as one visible assistant turn for "reescreva"', async () => {
    const session = buildDialogSession({
      id: "sess_route_rewrite",
      targetJobDescription: "Analista de BI Senior com foco em Power BI, SQL e ETL.",
    })
    const { POST } = await loadRoute()
    mockGetSession.mockResolvedValue(session)
    mockCreateChatCompletionStreamWithRetry.mockImplementation(
      async () => emptyStopStream() as never,
    )
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
    await userEvent.type(textarea, "reescreva")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      const assistantMessages = screen.getAllByTestId("message-assistant")
      expect(assistantMessages).toHaveLength(2)

      const finalAssistantMessage = assistantMessages[assistantMessages.length - 1]
      expect(finalAssistantMessage).toHaveTextContent("Posso reescrever agora seu resumo profissional.")
      expect(finalAssistantMessage).toHaveTextContent("Ja tenho seu curriculo e a vaga como referencia.")
      expect(finalAssistantMessage).not.toHaveTextContent(
        "Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo.",
      )
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
      "SQL avancado, ETL, comunicacao com areas nao tecnicas e Power BI.",
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
    await userEvent.type(textarea, jobDescription)
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      const assistantMessages = screen.getAllByTestId("message-assistant")
      expect(assistantMessages).toHaveLength(2)

      const finalAssistantMessage = assistantMessages[assistantMessages.length - 1]
      expect(finalAssistantMessage).toHaveTextContent("Recebi essa nova vaga")
      expect(finalAssistantMessage).toHaveTextContent("adaptar agora seu resumo")
      expect(finalAssistantMessage).not.toHaveTextContent(
        "Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo.",
      )
    })
  }, 10000)
})
