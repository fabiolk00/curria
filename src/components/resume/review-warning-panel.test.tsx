import { render, screen, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, expect, it } from "vitest"

import { ReviewWarningPanel } from "./review-warning-panel"
import type { CvHighlightState } from "@/lib/resume/cv-highlight-artifact"

type ReviewItem = NonNullable<CvHighlightState["reviewItems"]>[number]

const repeatedRequirements = [
  "Negociar e fechar vendas com novos clientes",
  "Mapear oportunidades com clientes existentes",
  "Experiência na área comercial",
  "Realizar reuniões comerciais",
  "Manter follow-ups e atualizar CRM",
  "Realizar visitas comerciais",
  "Conhecimento em técnicas de vendas",
  "Gestão de carteira de clientes",
]

function encodeUtf8AsMojibake(value: string): string {
  return Array.from(new TextEncoder().encode(value), (byte) => String.fromCharCode(byte)).join("")
}

const reviewItem: ReviewItem = {
  id: "low-fit-1",
  kind: "low_fit_target_mismatch",
  severity: "risk",
  section: "general",
  sectionLabel: encodeUtf8AsMojibake("Diagnóstico da vaga"),
  issueType: "low_fit_target_mismatch",
  title: encodeUtf8AsMojibake("Esta vaga parece distante do seu currículo atual"),
  summary: encodeUtf8AsMojibake("A geração foi feita após seu aceite, mas a aderência entre a vaga e o histórico original exige revisão."),
  explanation: encodeUtf8AsMojibake("A vaga exige responsabilidades e requisitos que ainda não aparecem com evidência suficiente."),
  whyItMatters: encodeUtf8AsMojibake("A versão gerada pode aproximar seu currículo de uma função sem sustentação direta."),
  suggestedAction: encodeUtf8AsMojibake("Revise antes de enviar e destaque habilidades transferíveis comprovadas."),
  message: "A vaga parece distante.",
  targetRole: "Executivo De Vendas",
  provenProfile: encodeUtf8AsMojibake("Modelagem de dados, criação de dashboards em Power BI, Azure Databricks, PySpark e SQL."),
  jobRequirements: repeatedRequirements,
  preferredRequirements: ["Python", "APIs", "Microsoft Fabric"],
  missingEvidence: repeatedRequirements,
  unsupportedRequirements: repeatedRequirements,
  inline: false,
}

describe("ReviewWarningPanel", () => {
  it("renders the zip card structure faithfully", () => {
    render(<ReviewWarningPanel items={[reviewItem]} hasInlineHighlights={false} scrollClassName="lg:max-h-[32rem]" />)

    const panel = screen.getByTestId("override-review-panel")
    expect(panel).toHaveClass("bg-white", "rounded-2xl", "shadow-sm", "border", "border-gray-200", "overflow-hidden")

    expect(screen.getByText("Pontos para revisar")).toHaveClass("text-2xl", "font-bold", "text-gray-900")
    expect(screen.getByText(/Esta versão foi gerada mesmo com avisos de aderência à vaga/i)).toBeInTheDocument()
    expect(screen.getByText("Experiência relevante")).toBeInTheDocument()
    expect(screen.getByText("Seu perfil comprovado")).toBeInTheDocument()
    expect(screen.getByText("Pontos sem evidência suficiente")).toBeInTheDocument()
    expect(screen.getByText("Por que revisar")).toBeInTheDocument()

    const scrollContainer = screen.getByTestId("override-review-panel-scroll")
    expect(scrollContainer).toHaveClass("px-6", "pb-8", "space-y-8", "lg:max-h-[32rem]")
    expect(scrollContainer).not.toHaveClass("overflow-y-auto")
  })

  it("adapts review data to the fixed layout sections and repairs mojibake", () => {
    render(<ReviewWarningPanel items={[reviewItem]} hasInlineHighlights={true} />)

    expect(screen.getAllByText("Negociar e fechar vendas com novos clientes;")).toHaveLength(2)
    expect(screen.getAllByText("Mapear oportunidades com clientes existentes;")).toHaveLength(2)
    expect(screen.getByText(/Modelagem de dados, criação de dashboards em Power BI/i)).toBeInTheDocument()
    expect(screen.queryByText("Gestão de carteira de clientes;")).not.toBeInTheDocument()
    expect(screen.getByText(/A versão gerada pode aproximar seu currículo de uma função sem sustentação direta/i)).toBeInTheDocument()
    expect(screen.queryByText(/geraÃ/i)).not.toBeInTheDocument()
  })

  it("keeps missing-evidence content compact like the reference layout", () => {
    render(<ReviewWarningPanel items={[reviewItem]} hasInlineHighlights={true} />)

    const panel = screen.getByTestId("override-review-panel")
    const listItems = within(panel).getAllByRole("listitem")

    expect(listItems).toHaveLength(10)
    expect(within(panel).getAllByText("Negociar e fechar vendas com novos clientes;")).toHaveLength(2)
  })

  it("falls back to a neutral proven-profile paragraph when evidence is generic", () => {
    render(
      <ReviewWarningPanel
        items={[{
          ...reviewItem,
          provenProfile: encodeUtf8AsMojibake("Profissional com experiência técnica aderente ao currículo original."),
          supportedEvidence: [],
        }]}
        hasInlineHighlights={true}
      />,
    )

    expect(screen.getByText("O currículo original não deixou claro um perfil diretamente alinhado a esta vaga.")).toBeInTheDocument()
  })

  it("does not render the previous compact/expandable diagnostic UI", () => {
    render(<ReviewWarningPanel items={[reviewItem]} hasInlineHighlights={true} />)

    expect(screen.queryByText("Diagnóstico da vaga")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Ver detalhes/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Ocultar detalhes/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Não há trechos destacados automaticamente/i)).not.toBeInTheDocument()
    expect(screen.queryByText("Ponto para revisar")).not.toBeInTheDocument()
  })

  it("keeps the review board visible with guidance even when there are no inline highlights", () => {
    render(<ReviewWarningPanel items={[reviewItem]} hasInlineHighlights={false} />)

    expect(screen.getByTestId("override-review-panel")).toBeInTheDocument()
    expect(screen.getByText("Pontos para revisar")).toBeInTheDocument()
    expect(screen.getByText(/Recomendamos revisar os pontos abaixo antes de enviar/i)).toBeInTheDocument()
  })
})
