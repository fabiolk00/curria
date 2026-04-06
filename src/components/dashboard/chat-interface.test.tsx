import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

import { ChatInterface } from "./chat-interface"

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

function createSSEStream(events: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const chunks = events.map((e) => sseEvent(e))

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

function mockFetchSSE(events: unknown[], status = 200): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(createSSEStream(events), {
      status,
      headers: { "Content-Type": "text/event-stream" },
    }),
  )
}

function mockFetchJSON(body: unknown, status: number): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatInterface", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Default: session messages endpoint returns empty
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
        // Return non-OK to short-circuit the SSE reader (jsdom limitation)
        return new Response(
          JSON.stringify({ error: "test stub" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        )
      }
      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="sess_42" userName="Fabio" />)

    const textarea = screen.getByPlaceholderText("Cole a descrição da vaga aqui...")
    await userEvent.type(textarea, "Melhore meu curriculo")
    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.sessionId).toBe("sess_42")
    expect(body.message).toBe("Melhore meu curriculo")

    // User message should appear in the conversation
    await waitFor(() => {
      expect(screen.getByTestId("message-user")).toBeInTheDocument()
    })
  })

  it("shows a thinking animation while the agent request is pending", async () => {
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

    expect(
      screen.getByRole("status", { name: /processando resposta do agente/i }),
    ).toBeInTheDocument()
  })

  it("locks the session when API returns 429 with action: new_session", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/agent")) {
        return new Response(
          JSON.stringify({
            error: "Esta sessao atingiu o limite de 15 mensagens.",
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
      expect(
        screen.getByText(/atingiu o limite de mensagens/i),
      ).toBeInTheDocument()
    })

    // Input should be disabled after session lock
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
            error: "Seus creditos acabaram. Faca upgrade do seu plano para continuar.",
          }),
          { status: 402, headers: { "Content-Type": "application/json" } },
        )
      }
      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="sess_credits" userName="Fabio" onCreditsExhausted={onCreditsExhausted} />)

    const textarea = screen.getByPlaceholderText("Cole a descrição da vaga aqui...")
    await userEvent.type(textarea, "Preciso de mais creditos")
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
              error: "Seus creditos acabaram. Faca upgrade do seu plano para continuar.",
              action: "new_session",
            },
          ]),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        )
      }
      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })

    render(<ChatInterface sessionId="sess_stream" userName="Fabio" onCreditsExhausted={onCreditsExhausted} />)

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
            { delta: "Quase la..." },
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
      expect(
        screen.getByText(/atingiu o limite de mensagens/i),
      ).toBeInTheDocument()
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
            error: "Sessao nao encontrada. Inicie uma nova analise.",
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

    // Shows the expired session banner, NOT the message cap banner
    await waitFor(() => {
      expect(
        screen.getByText(/Sessão não encontrada/i),
      ).toBeInTheDocument()
    })

    // Does NOT show the cap-reached banner
    expect(screen.queryByText(/atingiu o limite de mensagens/i)).toBeNull()

    // Input is disabled
    await waitFor(() => {
      expect(textarea).toBeDisabled()
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
