import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ReviewWarningPanel } from "./review-warning-panel"
import type { CvHighlightState } from "@/lib/resume/cv-highlight-artifact"

type ReviewItem = NonNullable<CvHighlightState["reviewItems"]>[number]

const reviewItem: ReviewItem = {
  id: "low-fit-1",
  kind: "low_fit_target_mismatch",
  severity: "risk",
  section: "general",
  sectionLabel: "Resumo",
  issueType: "low_fit_target_role",
  title: "Esta vaga parece distante do seu currículo atual",
  summary: "Esta versão foi gerada com distância relevante entre os requisitos da vaga e as evidências do currículo original.",
  explanation: "A vaga exige responsabilidades e requisitos que ainda não aparecem com evidência suficiente no seu histórico.",
  whyItMatters: "Seu histórico original comprova melhor outro perfil profissional.",
  suggestedAction: "Revise antes de enviar e destaque habilidades transferíveis comprovadas.",
  message: "A vaga parece distante.",
  targetRole: "Vendedora/Vendedor JR",
  provenProfile: "Analista de dados e operações",
  jobRequirements: ["Cumprir metas de vendas estabelecidas", "Construir relacionamento com clientes"],
  unsupportedRequirements: ["CNH B e veículo próprio"],
  inline: false,
}

describe("ReviewWarningPanel", () => {
  it("renders human labels and structured low-fit context", () => {
    render(
      <ReviewWarningPanel
        items={[reviewItem]}
        hasInlineHighlights={false}
      />, 
    )

    expect(screen.getByText("Vaga alvo:")).toBeInTheDocument()
    expect(screen.getByText("O que a vaga pede:")).toBeInTheDocument()
    expect(screen.getByText("Seu perfil comprovado:")).toBeInTheDocument()
    expect(screen.getByText("Requisitos sem evidência suficiente:")).toBeInTheDocument()
    expect(screen.getByText("Por que revisar:")).toBeInTheDocument()
    expect(screen.getByText("Ação sugerida:")).toBeInTheDocument()
  })

  it("does not render legacy generic warning copy", () => {
    render(<ReviewWarningPanel items={[reviewItem]} hasInlineHighlights={true} />)

    expect(screen.queryByText(/Revise este ponto antes de enviar/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Identificamos um ponto que merece revisão/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/skill sem evidência/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/cargo alvo sem evidência/i)).not.toBeInTheDocument()
    expect(screen.queryByText("Ponto para revisar")).not.toBeInTheDocument()
    expect(screen.queryByText(/Ajustes de linguagem/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Esta versão contém um ponto que merece revisão/i)).not.toBeInTheDocument()
  })
})
