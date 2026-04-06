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
  ChatMessage: ({ role, content }: { role: string; content: string }) => (
    <div data-testid={`message-${role}`}>{content}</div>
  ),
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
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

  it("shows the visible greeting with the Clerk first name", () => {
    render(<ChatInterface />)

    expect(screen.getByRole("heading", { name: "Olá, Fabio!" })).toBeInTheDocument()
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

    const textarea = screen.getByPlaceholderText("Cole a descrição da vaga aqui...")
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

    const textarea = screen.getByPlaceholderText("Cole a descrição da vaga aqui...")
    await userEvent.type(textarea, "Ainda estou pensando")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      const messages = screen.getAllByTestId("message-assistant")
      expect(messages[messages.length - 1]).toHaveTextContent("Pensando...")
    })
  })

  it("locks the session when API returns 429 with action: new_session", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          JSON.stringify({
            error: "Esta sessão atingiu o limite de 15 mensagens.",
            action: "new_session",
            messageCount: 15,
            maxMessages: 15,
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="sess_capped" userName="Fabio" />)

    const textarea = screen.getByPlaceholderText("Cole a descrição da vaga aqui...")
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

    const textarea = screen.getByPlaceholderText("Cole a descrição da vaga aqui...")
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

    const textarea = screen.getByPlaceholderText("Cole a descrição da vaga aqui...")
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
              messageCount: 15,
              maxMessages: 15,
            },
          ]),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        )
      }

      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="sess_mid" userName="Fabio" />)

    const textarea = screen.getByPlaceholderText("Cole a descrição da vaga aqui...")
    await userEvent.type(textarea, "Continuar")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(screen.getByText(/atingiu o limite de mensagens/i)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(textarea).toBeDisabled()
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

    const textarea = screen.getByPlaceholderText("Cole a descrição da vaga aqui...")
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

    const textarea = screen.getByPlaceholderText("Cole a descrição da vaga aqui...")
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

    const textarea = screen.getByPlaceholderText("Cole a descrição da vaga aqui...")
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

    const textarea = screen.getByPlaceholderText("Cole a descrição da vaga aqui...")
    await userEvent.type(textarea, "Minha primeira mensagem")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(screen.getByText(/Minha primeira mensagem/i)).toBeInTheDocument()
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

    const textarea = screen.getByPlaceholderText("Cole a descrição da vaga aqui...")
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

    const textarea = screen.getByPlaceholderText("Cole a descrição da vaga aqui...")
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

    const textarea = screen.getByPlaceholderText("Cole a descrição da vaga aqui...")
    await userEvent.type(textarea, "Teste")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      const messages = screen.getAllByTestId("message-assistant")
      const lastMessage = messages[messages.length - 1]
      expect(lastMessage).toHaveTextContent("Failed to fetch")
    })
  })
})
