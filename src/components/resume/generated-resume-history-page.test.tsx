import "@testing-library/jest-dom"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { mockGeneratedResumeHistory } from "@/lib/generated-resume-mock"

import { GeneratedResumeHistoryPage } from "./generated-resume-history-page"

const mockPush = vi.fn()
const mockGetResumeGenerationHistory = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock("@/lib/dashboard/workspace-client", () => ({
  getResumeGenerationHistory: (...args: unknown[]) => mockGetResumeGenerationHistory(...args),
}))

function buildHistoryResponse(page: 1 | 2) {
  const items = page === 1
    ? mockGeneratedResumeHistory.slice(0, 4)
    : mockGeneratedResumeHistory.slice(4, 6)

  return {
    items,
    pagination: {
      page,
      limit: 4,
      totalItems: 6,
      totalPages: 2,
      hasNextPage: page === 1,
      hasPreviousPage: page === 2,
    },
  }
}

describe("GeneratedResumeHistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("open", vi.fn())
  })

  it("loads the first page and navigates to the second page", async () => {
    const user = userEvent.setup()

    mockGetResumeGenerationHistory
      .mockResolvedValueOnce(buildHistoryResponse(1))
      .mockResolvedValueOnce(buildHistoryResponse(2))

    render(<GeneratedResumeHistoryPage />)

    expect(await screen.findByText("Currículo gerado")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Próxima" }))

    await waitFor(() => {
      expect(mockGetResumeGenerationHistory).toHaveBeenNthCalledWith(2, 2, 4)
    })

    expect(await screen.findByText("Currículo adaptado para vaga")).toBeInTheDocument()
  })

  it("opens the protected PDF download URL in a new tab", async () => {
    const user = userEvent.setup()

    mockGetResumeGenerationHistory.mockResolvedValue(buildHistoryResponse(1))

    render(<GeneratedResumeHistoryPage />)

    await user.click(await screen.findByRole("button", {
      name: /Baixar PDF de Currículo gerado/i,
    }))

    expect(window.open).toHaveBeenCalledWith(
      "/api/file/sess_hist_001?download=pdf",
      "_blank",
      "noopener,noreferrer",
    )
  })

  it("pushes the viewer route when opening a card", async () => {
    const user = userEvent.setup()

    mockGetResumeGenerationHistory.mockResolvedValue(buildHistoryResponse(1))

    render(<GeneratedResumeHistoryPage />)

    const buttons = await screen.findAllByRole("button", {
      name: /Visualizar Currículo ATS otimizado/i,
    })

    await user.click(buttons[0])

    expect(mockPush).toHaveBeenCalledWith("/dashboard/resume/compare/sess_hist_002")
  })

  it("shows the retry state when the API call fails", async () => {
    const user = userEvent.setup()

    mockGetResumeGenerationHistory
      .mockRejectedValueOnce(new Error("Falha temporária"))
      .mockResolvedValueOnce(buildHistoryResponse(1))

    render(<GeneratedResumeHistoryPage />)

    expect(
      await screen.findByText("Não foi possível carregar seu histórico de currículos."),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }))

    await waitFor(() => {
      expect(mockGetResumeGenerationHistory).toHaveBeenNthCalledWith(2, 1, 4)
    })
  })
})
