import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

import { AddEvidenceModal } from "./add-evidence-modal"

describe("AddEvidenceModal", () => {
  it("collects real evidence and reports a saved state", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <AddEvidenceModal
        open
        requirementLabel="SAP FI"
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.getByText("Você tem experiência real com SAP FI?")).toBeInTheDocument()
    expect(screen.getByText(/Adicione apenas se isso fizer parte da sua experiência real/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText("Onde você usou isso?"), "Projeto de fechamento mensal")
    await user.type(screen.getByLabelText("O que você fez?"), "Apoiei conciliação e análise de lançamentos financeiros.")
    await user.type(screen.getByLabelText("Qual foi o resultado?"), "Reduzi retrabalho no acompanhamento financeiro.")
    await user.click(screen.getByRole("button", { name: "Salvar evidência no perfil" }))

    expect(onSubmit).toHaveBeenCalledWith({
      requirementLabel: "SAP FI",
      where: "Projeto de fechamento mensal",
      what: "Apoiei conciliação e análise de lançamentos financeiros.",
      result: "Reduzi retrabalho no acompanhamento financeiro.",
    })
    expect(screen.getByTestId("add-evidence-success")).toHaveTextContent("Evidência adicionada ao seu perfil")

    const renderedText = document.body.textContent ?? ""
    expect(renderedText).not.toMatch(/forbidden|claim policy|unsupported_claim|override|gerar mesmo assim/i)
  })

  it("lets the user decline without pretending the evidence exists", async () => {
    const user = userEvent.setup()
    const onDecline = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <AddEvidenceModal
        open
        requirementLabel="Kubernetes"
        onOpenChange={onOpenChange}
        onSubmit={vi.fn()}
        onDecline={onDecline}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Não tenho essa experiência" }))

    expect(onDecline).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
