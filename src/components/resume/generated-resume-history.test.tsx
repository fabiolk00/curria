import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { mockGeneratedResumeHistory } from "@/lib/generated-resume-mock"

import { GeneratedResumeHistory } from "./generated-resume-history"

describe("GeneratedResumeHistory", () => {
  const basePagination = {
    page: 1,
    limit: 4,
    totalItems: 6,
    totalPages: 2,
    hasNextPage: true,
    hasPreviousPage: false,
  }

  it("renders loading skeleton cards while history is loading", () => {
    const { container } = render(
      <GeneratedResumeHistory
        items={[]}
        pagination={{
          page: 1,
          limit: 4,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        }}
        isLoading
      />,
    )

    expect(screen.getByText("Currículos recentes")).toBeInTheDocument()
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(4)
  })

  it("renders the empty state CTA when there are no generated resumes", async () => {
    const user = userEvent.setup()
    const onStartResume = vi.fn()

    render(
      <GeneratedResumeHistory
        items={[]}
        pagination={{
          page: 1,
          limit: 4,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        }}
        onStartResume={onStartResume}
      />,
    )

    expect(screen.getByText("Nenhum currículo gerado ainda")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Melhorar currículo com IA" }))
    expect(onStartResume).toHaveBeenCalledTimes(1)
  })

  it("renders the error state and retries loading", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()

    render(
      <GeneratedResumeHistory
        items={[]}
        pagination={basePagination}
        error="Falha ao carregar o histórico."
        onRetry={onRetry}
      />,
    )

    expect(
      screen.getByText("Não foi possível carregar seu histórico de currículos."),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("renders chat, ATS and target-job cards with badges and actions", async () => {
    const user = userEvent.setup()
    const onDownloadPdf = vi.fn()
    const onOpen = vi.fn()

    render(
      <GeneratedResumeHistory
        items={mockGeneratedResumeHistory.slice(0, 3)}
        pagination={{
          page: 1,
          limit: 4,
          totalItems: 3,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        }}
        onDownloadPdf={onDownloadPdf}
        onOpen={onOpen}
      />,
    )

    expect(screen.getByText("Chat")).toBeInTheDocument()
    expect(screen.getByText("ATS geral")).toBeInTheDocument()
    expect(screen.getByText("Vaga alvo")).toBeInTheDocument()
    expect(screen.getAllByText("Concluído")).toHaveLength(3)

    await user.click(screen.getByRole("button", { name: /Baixar PDF de Currículo gerado no chat/i }))
    expect(onDownloadPdf).toHaveBeenCalledWith(mockGeneratedResumeHistory[0])

    await user.click(screen.getByRole("button", { name: /Visualizar Currículo para Data Analyst/i }))
    expect(onOpen).toHaveBeenCalledWith(mockGeneratedResumeHistory[2])
  })

  it("hides the PDF button when the artifact is unavailable", () => {
    render(
      <GeneratedResumeHistory
        items={[mockGeneratedResumeHistory[3]]}
        pagination={{
          page: 1,
          limit: 4,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        }}
      />,
    )

    expect(screen.getByText("Processando")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Baixar PDF de Currículo ATS otimizado/i }),
    ).not.toBeInTheDocument()
  })

  it("renders pagination controls and notifies page changes", async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()

    render(
      <GeneratedResumeHistory
        items={mockGeneratedResumeHistory.slice(0, 4)}
        pagination={basePagination}
        onPageChange={onPageChange}
      />,
    )

    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Próxima" }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it("renders the second page with the remaining 2 cards", () => {
    render(
      <GeneratedResumeHistory
        items={mockGeneratedResumeHistory.slice(4, 6)}
        pagination={{
          page: 2,
          limit: 4,
          totalItems: 6,
          totalPages: 2,
          hasNextPage: false,
          hasPreviousPage: true,
        }}
      />,
    )

    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument()
    expect(screen.getByText("Currículo adaptado para vaga")).toBeInTheDocument()
    expect(screen.getByText("Currículo gerado no chat")).toBeInTheDocument()
  })
})
