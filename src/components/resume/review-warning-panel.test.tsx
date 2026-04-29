import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
  sectionLabel: encodeUtf8AsMojibake("Diagn\u00f3stico da vaga"),
  issueType: "low_fit_target_mismatch",
  title: encodeUtf8AsMojibake("Esta vaga parece distante do seu curr\u00edculo atual"),
  summary: encodeUtf8AsMojibake("A gera\u00e7\u00e3o foi feita ap\u00f3s seu aceite, mas a ader\u00eancia entre a vaga e o hist\u00f3rico original exige revis\u00e3o."),
  explanation: encodeUtf8AsMojibake("A vaga exige responsabilidades e requisitos que ainda n\u00e3o aparecem com evid\u00eancia suficiente."),
  whyItMatters: encodeUtf8AsMojibake("A vers\u00e3o gerada pode aproximar seu curr\u00edculo de uma fun\u00e7\u00e3o sem sustenta\u00e7\u00e3o direta."),
  suggestedAction: encodeUtf8AsMojibake("Revise antes de enviar e destaque habilidades transfer\u00edveis comprovadas."),
  message: "A vaga parece distante.",
  targetRole: "Executivo De Vendas",
  provenProfile: encodeUtf8AsMojibake("Profissional com experi\u00eancia t\u00e9cnica aderente ao curr\u00edculo original."),
  jobRequirements: repeatedRequirements,
  preferredRequirements: ["Python", "APIs", "Microsoft Fabric"],
  missingEvidence: repeatedRequirements,
  unsupportedRequirements: repeatedRequirements,
  inline: false,
}

describe("ReviewWarningPanel", () => {
  it("keeps long review content inside an internal scroll container", () => {
    render(<ReviewWarningPanel items={[reviewItem]} hasInlineHighlights={false} />)

    const scrollContainer = screen.getByTestId("override-review-panel-scroll")
    expect(scrollContainer.className).toContain("max-h-")
    expect(scrollContainer.className).toContain("overflow-y-auto")
  })

  it("starts the low-fit card compact and repairs mojibake for display", () => {
    render(<ReviewWarningPanel items={[reviewItem]} hasInlineHighlights={false} />)

    expect(screen.getByText(/Esta vaga parece distante do seu currículo atual/i)).toBeInTheDocument()
    expect(screen.getByText("Vaga alvo")).toBeInTheDocument()
    expect(screen.getByText("Executivo De Vendas")).toBeInTheDocument()
    expect(screen.getByText("Principais pontos sem evidência")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Ver detalhes/i })).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(3)

    expect(screen.queryByText("Requisitos principais")).not.toBeInTheDocument()
    expect(screen.queryByText("Diferenciais da vaga")).not.toBeInTheDocument()
    expect(screen.queryByText("Seu perfil comprovado")).not.toBeInTheDocument()
    expect(screen.queryByText("Pontos sem evidência suficiente")).not.toBeInTheDocument()
    expect(screen.getByText(/geração/i)).toBeInTheDocument()
    expect(screen.getAllByText(/aderência/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/geraÃ/i)).not.toBeInTheDocument()
  })

  it("expands details on click without treating a generic proven profile as a strong conclusion", async () => {
    const user = userEvent.setup()
    render(<ReviewWarningPanel items={[reviewItem]} hasInlineHighlights={true} />)

    await user.click(screen.getByRole("button", { name: /Ver detalhes/i }))

    expect(screen.getByText("Requisitos principais")).toBeInTheDocument()
    expect(screen.getByText("Diferenciais da vaga")).toBeInTheDocument()
    expect(screen.getByText("Seu perfil comprovado")).toBeInTheDocument()
    expect(screen.getByText("Pontos sem evidência suficiente")).toBeInTheDocument()
    expect(screen.getByText("Por que revisar")).toBeInTheDocument()
    expect(screen.getByText("Ação sugerida")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Ocultar detalhes/i })).toBeInTheDocument()
    expect(screen.getByText(/função/i)).toBeInTheDocument()
    expect(screen.getByText(/sustentação/i)).toBeInTheDocument()
    expect(screen.getByText(/transferíveis/i)).toBeInTheDocument()
    expect(screen.getByText(/O currículo original não deixou claro um perfil diretamente alinhado/i)).toBeInTheDocument()
    expect(screen.queryByText(/experiência técnica aderente/i)).not.toBeInTheDocument()
  })

  it("limits duplicate requirement lists instead of rendering both full arrays", async () => {
    const user = userEvent.setup()
    render(<ReviewWarningPanel items={[reviewItem]} hasInlineHighlights={true} />)

    await user.click(screen.getByRole("button", { name: /Ver detalhes/i }))

    const panel = screen.getByTestId("override-review-panel")
    expect(within(panel).getAllByRole("listitem").length).toBeLessThan(repeatedRequirements.length * 2)
  })

  it("does not render legacy generic warning copy", () => {
    render(<ReviewWarningPanel items={[reviewItem]} hasInlineHighlights={true} />)

    expect(screen.queryByText(/Revise este ponto antes de enviar/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Identificamos um ponto que merece revisão/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/skill sem evidência/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/cargo alvo sem evidência/i)).not.toBeInTheDocument()
    expect(screen.queryByText("Ponto para revisar")).not.toBeInTheDocument()
    expect(screen.queryByText(/Ajustes de linguagem/i)).not.toBeInTheDocument()
  })
})
