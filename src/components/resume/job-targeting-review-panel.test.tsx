import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

import { JobTargetingReviewPanel } from "./job-targeting-review-panel"
import type { UserFriendlyJobReview } from "@/lib/agent/job-targeting/user-friendly-review"

function buildReview(): UserFriendlyJobReview {
  return {
    title: "Antes de gerar, precisamos revisar alguns pontos",
    description: "A vaga pede algumas experiências que ainda não aparecem claramente no seu currículo. Para proteger sua candidatura, não vamos afirmar algo sem evidência.",
    fitLevel: "partial",
    canGenerateConservativeVersion: true,
    requirements: [
      {
        id: "power-bi",
        label: "Power BI",
        status: "proven",
        explanation: "Encontramos evidência suficiente no seu currículo para mencionar esse ponto com segurança.",
        foundEvidence: ["Desenvolvimento de dashboards e indicadores executivos."],
        canAddEvidence: false,
      },
      {
        id: "forecast",
        label: "Forecast",
        status: "related",
        explanation: "Seu currículo mostra experiência próxima, mas ainda não comprova esse requisito de forma direta.",
        foundEvidence: ["Análise de indicadores e projeções de desempenho."],
        safeSuggestion: "Podemos mencionar análise de tendências e apoio à tomada de decisão, sem afirmar domínio específico de Forecast se isso não estiver claro.",
        canAddEvidence: true,
      },
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
  }
}

describe("JobTargetingReviewPanel", () => {
  it("renders friendly requirement statuses without technical policy terms", () => {
    render(<JobTargetingReviewPanel review={buildReview()} />)

    expect(screen.getByTestId("job-targeting-review-panel")).toBeInTheDocument()
    expect(screen.getByText("Revisão antes de gerar")).toBeInTheDocument()
    expect(screen.getByText("Antes de gerar, precisamos revisar alguns pontos")).toBeInTheDocument()
    expect(screen.getByText("Comprovado")).toBeInTheDocument()
    expect(screen.getByText("Experiência relacionada")).toBeInTheDocument()
    expect(screen.getByText("Precisa de evidência")).toBeInTheDocument()
    expect(screen.getByText("SAP FI")).toBeInTheDocument()
    expect(screen.getByText("A vaga pede SAP FI, mas não encontramos essa experiência no seu currículo.")).toBeInTheDocument()

    const renderedText = screen.getByTestId("job-targeting-review-panel").textContent ?? ""
    expect(renderedText).not.toMatch(/forbidden_term|claim_policy|unsupported_claim|must_not_claim|validation block|hard issue|override|bloqueado|proibido|gerar mesmo assim/i)
  })

  it("offers evidence and conservative actions without bypass wording", async () => {
    const user = userEvent.setup()
    const onAddEvidence = vi.fn()
    const onContinueWithoutRequirement = vi.fn()
    const onGenerateConservativeVersion = vi.fn()
    const onChooseAnotherJob = vi.fn()

    render(
      <JobTargetingReviewPanel
        review={buildReview()}
        onAddEvidence={onAddEvidence}
        onContinueWithoutRequirement={onContinueWithoutRequirement}
        onGenerateConservativeVersion={onGenerateConservativeVersion}
        onChooseAnotherJob={onChooseAnotherJob}
      />,
    )

    await user.click(screen.getAllByRole("button", { name: "Adicionar evidência" })[0])
    await user.click(screen.getByRole("button", { name: "Continuar sem mencionar SAP FI" }))
    await user.click(screen.getByRole("button", { name: "Gerar versão conservadora" }))
    await user.click(screen.getByRole("button", { name: "Escolher outra vaga" }))

    expect(onAddEvidence).toHaveBeenCalledWith(expect.objectContaining({ label: "Forecast" }))
    expect(onContinueWithoutRequirement).toHaveBeenCalledWith(expect.objectContaining({ label: "SAP FI" }))
    expect(onGenerateConservativeVersion).toHaveBeenCalledTimes(1)
    expect(onChooseAnotherJob).toHaveBeenCalledTimes(1)
  })
})
