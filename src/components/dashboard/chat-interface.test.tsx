import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

import { ChatInterface } from "./chat-interface"

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

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

function sseEvent(data: unknown): string {
  const event = (() => {
    if (!data || typeof data !== "object" || Array.isArray(data) || "type" in data) {
      return data
    }

    const legacy = data as Record<string, unknown>

    if ("delta" in legacy) {
      return { type: "text", content: legacy.delta }
    }

    if ("sessionCreated" in legacy && legacy.sessionCreated) {
      return { type: "sessionCreated", sessionId: legacy.sessionId }
    }

    if ("done" in legacy && legacy.done) {
      return {
        type: "done",
        sessionId: legacy.sessionId,
        phase: legacy.phase,
        atsScore: legacy.atsScore,
        messageCount: legacy.messageCount,
        maxMessages: legacy.maxMessages,
        isNewSession: legacy.isNewSession,
      }
    }

    if ("error" in legacy) {
      return {
        type: "error",
        error: legacy.error,
        code: legacy.code,
        action: legacy.action,
        messageCount: legacy.messageCount,
        maxMessages: legacy.maxMessages,
        upgradeUrl: legacy.upgradeUrl,
      }
    }

    return data
  })()

  return `data: ${JSON.stringify(event)}\n\n`
}

function createSSEStream(events: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const chunks = events.map((event) => sseEvent(event))

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

function createPendingSSEStream(events: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const chunks = events.map((event) => sseEvent(event))

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
    },
  })
}

function createDeferredResponse() {
  let resolve: (value: Response) => void
  let reject: (reason?: unknown) => void

  const promise = new Promise<Response>((res, rej) => {
    resolve = res
    reject = rej
  })

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  }
}

describe("ChatInterface", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), { status: 200 }),
    )
  })

  it("renders welcome message with the user first name", () => {
    render(<ChatInterface userName="Fabio" />)

    const matches = screen.getAllByText(/Olá, Fabio!/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it("shows the visible greeting from the explicit server-provided userName", () => {
    render(<ChatInterface userName="Fabio" />)

    expect(screen.getByRole("heading", { name: "Olá, Fabio!" })).toBeInTheDocument()
  })

  it("revalidates missing contact info from the live profile and suppresses a stale phone warning", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url === "/api/profile") {
        return new Response(JSON.stringify({
          profile: {
            profilePhotoUrl: null,
            cvState: {
              email: "fabio@example.com",
              phone: "(11) 99999-9999",
            },
          },
        }), { status: 200 })
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(
      <ChatInterface
        userName="Fabio"
        missingContactInfo={{ missingEmail: false, missingPhone: true }}
      />,
    )

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/profile", expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      }))
    })

    expect(
      screen.queryByText(/adicione seu telefone/i),
    ).not.toBeInTheDocument()
  })

  it("shows warnings for missing base profile items except certifications", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url === "/api/profile") {
        return new Response(JSON.stringify({
          profile: {
            profilePhotoUrl: null,
            cvState: {
              fullName: "Fabio",
              email: "fabio@example.com",
              phone: "",
              linkedin: "",
              location: "Sao Paulo",
              summary: "",
              skills: ["SQL", "Power BI", "Python"],
              experience: [{
                title: "Analista de Dados",
                company: "Empresa X",
                startDate: "2022",
                endDate: "2024",
                bullets: ["Criei dashboards"],
              }],
              education: [{
                degree: "Sistemas de Informacao",
                institution: "USP",
                year: "2021",
              }],
              certifications: [],
            },
          },
        }), { status: 200 })
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface userName="Fabio" />)

    await waitFor(() => {
      expect(
        screen.getByText(/adicione seu telefone/i),
      ).toBeInTheDocument()
      expect(
        screen.getByText(/resumo profissional: escreva um resumo curto/i),
      ).toBeInTheDocument()
    })

    expect(screen.queryByText(/certificacao/i)).not.toBeInTheDocument()
  })

  it("preserves the optimistic conversation when the first message is sent before /api/profile resolves", async () => {
    const profileRequest = createDeferredResponse()
    let profileResolved = false

    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (typeof url === "string" && url === "/api/profile") {
        return profileRequest.promise
      }

      if (typeof url === "string" && url === "/api/agent") {
        return Promise.resolve(new Response(createPendingSSEStream([]), {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }))
      }

      return Promise.resolve(new Response(JSON.stringify({ messages: [] }), { status: 200 }))
    })

    render(
      <ChatInterface
        userName="Fabio"
        missingContactInfo={{ missingEmail: false, missingPhone: false }}
      />,
    )

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Primeira mensagem antes do perfil")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(screen.getByText("Primeira mensagem antes do perfil")).toBeInTheDocument()
    })

    profileRequest.resolve(new Response(JSON.stringify({
      profile: {
        profilePhotoUrl: null,
        cvState: {
          email: "fabio@example.com",
          phone: "",
        },
      },
    }), { status: 200 }))
    profileResolved = true

    await waitFor(() => {
      expect(profileResolved).toBe(true)
    })

    expect(screen.getByText("Primeira mensagem antes do perfil")).toBeInTheDocument()
    expect(
      screen.getByText(/Quer que eu adapte o curriculo para uma vaga especifica/i),
    ).toBeInTheDocument()

    const assistantMessages = screen.getAllByTestId("message-assistant")
    expect(assistantMessages[assistantMessages.length - 1]).toHaveTextContent("Pensando...")
  })

  it.each([
    {
      name: "when /api/profile returns profile: null",
      profileResponse: () => Promise.resolve(new Response(JSON.stringify({ profile: null }), { status: 200 })),
    },
    {
      name: "when /api/profile fails",
      profileResponse: () => Promise.reject(new Error("profile unavailable")),
    },
  ])("keeps prop-based missingContactInfo as fallback $name", async ({ profileResponse }) => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (typeof url === "string" && url === "/api/profile") {
        return profileResponse()
      }

      return Promise.resolve(new Response(JSON.stringify({ messages: [] }), { status: 200 }))
    })

    render(
      <ChatInterface
        userName="Fabio"
        missingContactInfo={{ missingEmail: true, missingPhone: false }}
      />,
    )

    await waitFor(() => {
      expect(
        screen.getByText(/adicione seu e-mail/i),
      ).toBeInTheDocument()
    })
  })

  it("keeps prop-based missingContactInfo when /api/profile returns a non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (typeof url === "string" && url === "/api/profile") {
        return Promise.resolve(new Response(JSON.stringify({ error: "profile failed" }), { status: 500 }))
      }

      return Promise.resolve(new Response(JSON.stringify({ messages: [] }), { status: 200 }))
    })

    render(
      <ChatInterface
        userName="Fabio"
        missingContactInfo={{ missingEmail: false, missingPhone: true }}
      />,
    )

    await waitFor(() => {
      expect(
        screen.getByText(/adicione seu telefone/i),
      ).toBeInTheDocument()
    })
  })

  it("runs in vacancy-only mode without rendering a file upload control", () => {
    const { container } = render(<ChatInterface userName="Fabio" />)

    expect(container.querySelector('input[type="file"]')).toBeNull()
    expect(
      screen.getByText(/Quando fizer sentido, clique em Aceito para gerar seu curriculo\./i),
    ).toBeInTheDocument()
  })

  it("sends agent POST with correct payload when user presses Enter", async () => {
    const fetchSpy = vi.fn()

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        fetchSpy(url, init)
        return new Response(JSON.stringify({ error: "test stub" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="sess_42" userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Melhore meu currículo")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.sessionId).toBe("sess_42")
    expect(body.message).toBe("Melhore meu currículo")

    await waitFor(() => {
      expect(screen.getByTestId("message-user")).toBeInTheDocument()
    })
  })

  it("shows the thinking state inside the assistant bubble while the agent request is pending", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Promise<Response>(() => {})
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="sess_waiting" userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Ainda estou pensando")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      const messages = screen.getAllByTestId("message-assistant")
      expect(messages[messages.length - 1]).toHaveTextContent("Pensando...")
    })
  })

  it('shows the Aceito button in confirm phase and sends the approval keyword when clicked', async () => {
    const fetchSpy = vi.fn()
    let agentCallCount = 0

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        agentCallCount += 1
        fetchSpy(url, init)

        if (agentCallCount === 1) {
          return new Response(
            createSSEStream([
              { type: "patch", patch: { phase: "confirm" }, phase: "confirm" },
              { type: "text", content: 'Quando fizer sentido, clique em "Aceito" para gerar seu curriculo.' },
              { type: "done", sessionId: "sess_confirm", phase: "confirm", messageCount: 3 },
            ]),
            { status: 200, headers: { "Content-Type": "text/event-stream", "X-Session-Id": "sess_confirm" } },
          )
        }

        return new Response(
          createSSEStream([
            { type: "text", content: "Seu curriculo ATS-otimizado em PDF esta pronto. ATS Score antes: 47/100. ATS agora: 63/100. Confira o download e a pre-visualizacao acima." },
            { type: "done", sessionId: "sess_confirm", phase: "generation", messageCount: 4 },
          ]),
          { status: 200, headers: { "Content-Type": "text/event-stream", "X-Session-Id": "sess_confirm" } },
        )
      }

      if (typeof url === "string" && url === "/api/session/sess_confirm") {
        return new Response(
          JSON.stringify({
            session: {
              phase: agentCallCount > 1 ? "generation" : "confirm",
              messageCount: agentCallCount > 1 ? 4 : 3,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="sess_confirm" userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "gere o arquivo")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(screen.getByTestId("chat-accept-generate")).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId("chat-accept-generate"))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    const [, secondInit] = fetchSpy.mock.calls[1] as [string, RequestInit]
    const secondBody = JSON.parse(secondInit.body as string) as Record<string, unknown>
    expect(secondBody.message).toBe("Aceito")
  })

  it('shows the Aceito button in dialog after ATS context is available', async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createSSEStream([
            { type: "text", content: "Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo." },
            { type: "done", sessionId: "sess_dialog_ready", phase: "dialog", atsScore: { total: 47 }, messageCount: 3 },
          ]),
          { status: 200, headers: { "Content-Type": "text/event-stream", "X-Session-Id": "sess_dialog_ready" } },
        )
      }

      if (typeof url === "string" && url === "/api/session/sess_dialog_ready") {
        return new Response(
          JSON.stringify({
            session: {
              phase: "dialog",
              atsScore: { total: 47 },
              messageCount: 3,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="sess_dialog_ready" userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "vaga alvo")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(screen.getByTestId("chat-accept-generate")).toBeInTheDocument()
    })
  })

  it("locks the session when API returns 429 with action: new_session", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          JSON.stringify({
            error: "Esta sessão atingiu o limite de 30 mensagens.",
            action: "new_session",
            messageCount: 30,
            maxMessages: 30,
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="sess_capped" userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Mais uma mensagem")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(screen.getByText(/atingiu o limite de mensagens/i)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(textarea).toBeDisabled()
    })
  })

  it("opens the credits exhausted flow when the agent returns a 402 error", async () => {
    const onCreditsExhausted = vi.fn()

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          JSON.stringify({
            error: "Seus créditos acabaram. Faça upgrade do seu plano para continuar.",
          }),
          { status: 402, headers: { "Content-Type": "application/json" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(
      <ChatInterface
        sessionId="sess_credits"
        userName="Fabio"
        onCreditsExhausted={onCreditsExhausted}
      />,
    )

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Preciso de mais créditos")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(onCreditsExhausted).toHaveBeenCalledTimes(1)
    })
  })

  it("opens the credits exhausted flow when the streamed error chunk arrives", async () => {
    const onCreditsExhausted = vi.fn()

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createSSEStream([
            {
              error: "Seus créditos acabaram. Faça upgrade do seu plano para continuar.",
              action: "new_session",
            },
          ]),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(
      <ChatInterface
        sessionId="sess_stream"
        userName="Fabio"
        onCreditsExhausted={onCreditsExhausted}
      />,
    )

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Streamed credit error")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(onCreditsExhausted).toHaveBeenCalledTimes(1)
    })
  })

  it("locks the session when SSE error chunk contains action: new_session", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createSSEStream([
            { delta: "Quase lá..." },
            {
              error: "Limite atingido.",
              action: "new_session",
              messageCount: 30,
              maxMessages: 30,
            },
          ]),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="sess_mid" userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Continuar")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(screen.getByText(/atingiu o limite de mensagens/i)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(textarea).toBeDisabled()
    })
  })

  it("does not surface recoverable LLM_INVALID_OUTPUT stream errors in the final assistant bubble", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createSSEStream([
            { delta: "Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo. " },
            {
              error: "Invalid gap analysis payload.",
              code: "LLM_INVALID_OUTPUT",
            },
            {
              delta: "Pontuacao ATS atual: 51/100. Posso seguir reescrevendo seu resumo ou experiencia com base nesses pontos.",
            },
            { done: true, sessionId: "sess_recoverable", phase: "analysis" },
          ]),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="sess_recoverable" userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Reescreva meu currículo para essa vaga")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      const assistantMessages = screen.getAllByTestId("message-assistant")
      const finalAssistantMessage = assistantMessages[assistantMessages.length - 1]
      expect(finalAssistantMessage).toHaveTextContent(
        /Recebi a vaga e ela ja ficou salva como referencia para o seu curriculo/i,
      )
      expect(finalAssistantMessage).toHaveTextContent(
        /Pontuacao ATS atual: 51\/100\. Posso seguir reescrevendo seu resumo ou experiencia com base nesses pontos\./i,
      )
      expect(finalAssistantMessage).not.toHaveTextContent(/Aviso:\s*Invalid gap analysis payload\./i)
    })
  })

  it("keeps one coherent assistant bubble for a recoverable rewrite stream", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createSSEStream([
            { type: "sessionCreated", sessionId: "sess_rewrite_single" },
            { type: "text", content: "Posso reescrever agora seu resumo profissional. " },
            {
              type: "error",
              error: "Invalid gap analysis payload.",
              code: "LLM_INVALID_OUTPUT",
            },
            { type: "text", content: "Ja tenho seu curriculo e a vaga como referencia." },
            { type: "done", sessionId: "sess_rewrite_single", phase: "dialog", messageCount: 2 },
          ]),
          {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "X-Session-Id": "sess_rewrite_single",
            },
          },
        )
      }

      if (typeof url === "string" && url === "/api/session/sess_rewrite_single") {
        return new Response(
          JSON.stringify({
            session: {
              phase: "dialog",
              messageCount: 2,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "reescreva")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      const assistantMessages = screen.getAllByTestId("message-assistant")
      expect(assistantMessages).toHaveLength(2)

      const finalAssistantMessage = assistantMessages[assistantMessages.length - 1]
      expect(finalAssistantMessage).toHaveTextContent(
        /Posso reescrever agora seu resumo profissional\. Ja tenho seu curriculo e a vaga como referencia\./i,
      )
      expect(finalAssistantMessage).not.toHaveTextContent(/Aviso:\s*Invalid gap analysis payload\./i)
    })
  })

  it("preserves a richer streamed assistant transcript when late history hydration is shorter", async () => {
    let resolveHistoryFetch: ((response: Response) => void) | null = null
    const historyFetch = new Promise<Response>((resolve) => {
      resolveHistoryFetch = resolve
    })

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createSSEStream([
            { type: "sessionCreated", sessionId: "sess_history_reconcile" },
            { type: "text", content: "Posso reescrever agora seu resumo profissional. " },
            { type: "text", content: "Ja tenho seu curriculo e a vaga como referencia." },
            { type: "done", sessionId: "sess_history_reconcile", phase: "dialog", messageCount: 2 },
          ]),
          {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "X-Session-Id": "sess_history_reconcile",
            },
          },
        )
      }

      if (typeof url === "string" && url === "/api/session/sess_history_reconcile/messages") {
        return historyFetch
      }

      if (typeof url === "string" && url === "/api/session/sess_history_reconcile") {
        return new Response(
          JSON.stringify({
            session: {
              phase: "dialog",
              messageCount: 2,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "reescreva")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      const assistantMessages = screen.getAllByTestId("message-assistant")
      expect(assistantMessages).toHaveLength(2)
      expect(assistantMessages[assistantMessages.length - 1]).toHaveTextContent(
        /Posso reescrever agora seu resumo profissional\. Ja tenho seu curriculo e a vaga como referencia\./i,
      )
    })

    expect(resolveHistoryFetch).not.toBeNull()
    resolveHistoryFetch!(
      new Response(
        JSON.stringify({
          messages: [
            {
              role: "user",
              content: "reescreva",
              createdAt: "2026-04-10T12:48:00.000Z",
            },
            {
              role: "assistant",
              content: "Posso reescrever agora seu resumo profissional.",
              createdAt: "2026-04-10T12:48:01.000Z",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )

    await waitFor(() => {
      const assistantMessages = screen.getAllByTestId("message-assistant")
      expect(assistantMessages).toHaveLength(2)
      expect(assistantMessages[assistantMessages.length - 1]).toHaveTextContent(
        /Posso reescrever agora seu resumo profissional\. Ja tenho seu curriculo e a vaga como referencia\./i,
      )
    })
  })

  it("shows expired banner (not cap banner) and disables input on 404 stale session", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          JSON.stringify({
            error: "Sessão não encontrada. Inicie uma nova análise.",
            action: "new_session",
          }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="stale_id" userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Oi")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(
        screen.getByText(/Sessão não encontrada\. Inicie uma nova análise para continuar\./i),
      ).toBeInTheDocument()
    })

    expect(screen.queryByText(/atingiu o limite de mensagens/i)).toBeNull()

    await waitFor(() => {
      expect(textarea).toBeDisabled()
    })
  })

  it("resets the composer and conversation when the session prop is cleared", async () => {
    const { rerender } = render(<ChatInterface sessionId="sess_reset" userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i) as HTMLTextAreaElement

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          JSON.stringify({
            error: "Esta sessão atingiu o limite de 30 mensagens.",
            action: "new_session",
            messageCount: 30,
            maxMessages: 30,
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    await userEvent.type(textarea, "Forçar reset")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(textarea).toBeDisabled()
    })

    rerender(<ChatInterface userName="Fabio" />)

    await waitFor(() => {
      expect(textarea).not.toBeDisabled()
    })

    expect(screen.queryByText(/atingiu o limite de mensagens/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Tenho seu curriculo salvo aqui/i)).toBeInTheDocument()
  })

  it("reads X-Session-Id header and fires onSessionChange before SSE parsing", async () => {
    const onSessionChange = vi.fn()

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createSSEStream([
            { sessionCreated: true, sessionId: "sess_hdr" },
            { done: true, sessionId: "sess_hdr", phase: "intake" },
          ]),
          {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "X-Session-Id": "sess_hdr",
            },
          },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(
      <ChatInterface userName="Fabio" onSessionChange={onSessionChange} />,
    )

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Nova sessão")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(onSessionChange).toHaveBeenCalledWith("sess_hdr")
    })

    // Called at least once from header, possibly again from sessionCreated/done SSE
    expect(onSessionChange.mock.calls[0][0]).toBe("sess_hdr")
  })

  it("fires onSessionChange from sessionCreated SSE event even without X-Session-Id header", async () => {
    const onSessionChange = vi.fn()

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createSSEStream([
            { sessionCreated: true, sessionId: "sess_sse_only" },
            { done: true, sessionId: "sess_sse_only", phase: "intake" },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(
      <ChatInterface userName="Fabio" onSessionChange={onSessionChange} />,
    )

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Fallback test")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(onSessionChange).toHaveBeenCalledWith("sess_sse_only")
    })
  })

  it("preserves optimistic chat messages when the first history fetch returns empty", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createSSEStream([
            { sessionCreated: true, sessionId: "sess_preserve" },
            { done: true, sessionId: "sess_preserve", phase: "intake", messageCount: 1 },
          ]),
          {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "X-Session-Id": "sess_preserve",
            },
          },
        )
      }

      if (typeof url === "string" && url.includes("/api/session/sess_preserve/messages")) {
        return new Response(JSON.stringify({ messages: [] }), { status: 200 })
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Minha primeira mensagem")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(screen.getByText(/Minha primeira mensagem/i)).toBeInTheDocument()
    })
  })

  it("replaces the thinking bubble when the stream ends without assistant delta text", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createSSEStream([
            { done: true, sessionId: "sess_empty", phase: "dialog", messageCount: 2 },
          ]),
          {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "X-Session-Id": "sess_empty",
            },
          },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Teste sem delta")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      const messages = screen.getAllByTestId("message-assistant")
      const lastMessage = messages[messages.length - 1]
      expect(lastMessage).toHaveTextContent("Analisei sua mensagem, mas não consegui concluir a resposta desta vez.")
    })
  })

  it("opens the credits modal immediately when there are no credits and no reusable session", async () => {
    const onCreditsExhausted = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    render(
      <ChatInterface
        userName="Fabio"
        currentCredits={0}
        onCreditsExhausted={onCreditsExhausted}
      />,
    )

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Quero iniciar uma análise")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(onCreditsExhausted).toHaveBeenCalledTimes(1)
    })

    expect(fetchSpy).not.toHaveBeenCalledWith("/api/agent", expect.anything())
    expect(screen.getByText(/créditos acabaram/i)).toBeInTheDocument()
  })

  it("opens the credits modal when the session ends and no credits remain", async () => {
    const onCreditsExhausted = vi.fn()

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          JSON.stringify({
            error: "Sessão não encontrada. Inicie uma nova análise.",
            action: "new_session",
          }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(
      <ChatInterface
        sessionId="sess_stale"
        userName="Fabio"
        currentCredits={0}
        onCreditsExhausted={onCreditsExhausted}
      />,
    )

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Continuar")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(onCreditsExhausted).toHaveBeenCalledTimes(1)
    })
  })

  it("shows generic error when fetch fails with network error", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        throw new Error("Failed to fetch")
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Teste")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      const messages = screen.getAllByTestId("message-assistant")
      const lastMessage = messages[messages.length - 1]
      expect(lastMessage).toHaveTextContent("Failed to fetch")
    })
  })

  it("shows the tool execution indicator on toolStart", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createPendingSSEStream([
            { type: "toolStart", toolName: "parse_file" },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="sess_tool" userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Execute a ferramenta")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(screen.getByTestId("tool-status")).toHaveTextContent("Executando parse_file...")
    })
  })

  it("clears the tool execution indicator on patch", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createSSEStream([
            { type: "toolStart", toolName: "rewrite_section" },
            { type: "patch", patch: {}, phase: "dialog" },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="sess_patch" userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Aplique a mudança")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(screen.queryByTestId("tool-status")).not.toBeInTheDocument()
    })
  })

  it("clears the tool execution indicator when assistant text starts streaming", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createSSEStream([
            { type: "toolStart", toolName: "preparo da resposta" },
            { type: "text", content: "Resposta pronta." },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="sess_text_clear" userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Aplique a mudanca")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(screen.queryByTestId("tool-status")).not.toBeInTheDocument()
      expect(screen.getAllByTestId("message-assistant").at(-1)).toHaveTextContent("Resposta pronta.")
    })
  })

  it("refetches the session snapshot on done and applies the server truth to the header", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createSSEStream([
            { type: "done", sessionId: "sess_done", phase: "intake", messageCount: 1 },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        )
      }

      if (typeof url === "string" && url === "/api/session/sess_done") {
        return new Response(
          JSON.stringify({
            session: {
              phase: "dialog",
              atsScore: { total: 88 },
              messageCount: 3,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Sincronize a sessão")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/session/sess_done", {
        credentials: "include",
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/Mensagem\s+3\s+de\s+30/i)).toBeInTheDocument()
      expect(screen.getByText(/Fase:\s+dialog/i)).toBeInTheDocument()
      expect(screen.getByText(/ATS:\s+88/i)).toBeInTheDocument()
    })
  })

  it("keeps the UI usable when the done-session refetch fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createSSEStream([
            { type: "done", sessionId: "sess_refetch_fail", phase: "dialog", messageCount: 1 },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        )
      }

      if (typeof url === "string" && url === "/api/session/sess_refetch_fail") {
        throw new Error("refetch failed")
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Finalize")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      const messages = screen.getAllByTestId("message-assistant")
      const lastMessage = messages[messages.length - 1]
      expect(lastMessage).toHaveTextContent("Analisei sua mensagem")
    })

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("[chat] failed to refetch session on done")
    })

    consoleErrorSpy.mockRestore()
  })

  it("exposes stable root state hooks for the initial composer state", () => {
    render(<ChatInterface userName="Fabio" />)

    expect(screen.getByTestId("chat-interface")).toHaveAttribute("data-session-id", "")
    expect(screen.getByTestId("chat-interface")).toHaveAttribute("data-phase", "intake")
    expect(screen.getByTestId("chat-interface")).toHaveAttribute("data-message-count", "0")
  })

  it("updates the stable root state hooks after a completed streamed turn", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          createSSEStream([
            { type: "done", sessionId: "sess_state_hooks", phase: "dialog", messageCount: 1 },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        )
      }

      if (typeof url === "string" && url === "/api/session/sess_state_hooks") {
        return new Response(
          JSON.stringify({
            session: {
              phase: "dialog",
              atsScore: { total: 88 },
              messageCount: 3,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface userName="Fabio" />)

    const textarea = screen.getByPlaceholderText(/Cole a descri.*vaga aqui/i)
    await userEvent.type(textarea, "Atualize o estado")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(screen.getByTestId("chat-interface")).toHaveAttribute("data-session-id", "sess_state_hooks")
      expect(screen.getByTestId("chat-interface")).toHaveAttribute("data-phase", "dialog")
      expect(screen.getByTestId("chat-interface")).toHaveAttribute("data-message-count", "3")
    })
  })
})
