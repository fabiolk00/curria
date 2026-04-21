import { describe, expect, it } from "vitest"

import type { CVState } from "@/types/cv"

import { buildOptimizedPreviewHighlights, buildRelevantHighlightLine } from "./optimized-preview-highlights"

function buildCvState(input: Partial<CVState>): CVState {
  return {
    fullName: "Fábio Kröker",
    email: "fabio@example.com",
    phone: "555-0100",
    linkedin: "linkedin.com/in/fabiokroker",
    location: "Curitiba, Paraná, Brazil",
    summary: "",
    experience: [],
    skills: [],
    education: [],
    certifications: [],
    ...input,
  }
}

describe("optimized preview highlights", () => {
  it("does not highlight minor punctuation-only changes", () => {
    const result = buildRelevantHighlightLine(
      "Engenheiro de dados com foco em BI",
      "Engenheiro de dados com foco em BI.",
    )

    expect(result.segments.some((segment) => segment.highlighted)).toBe(false)
  })

  it("highlights relevant summary chunks instead of isolated words", () => {
    const result = buildRelevantHighlightLine(
      "Consultor de Business Intelligence com entrega de dashboards.",
      "Atuação em Senior Business Intelligence, Consultor de Business Intelligence e Desenvolvedor de Business Intelligence, com entrega de dashboards.",
      "summary",
    )

    const highlightedSegments = result.segments.filter((segment) => segment.highlighted)
    expect(highlightedSegments.some((segment) => segment.text.includes("Senior Business Intelligence"))).toBe(true)
    expect(highlightedSegments.some((segment) => segment.text.includes("Desenvolvedor de Business Intelligence"))).toBe(true)
    expect(highlightedSegments.every((segment) => segment.text.trim().split(/\s+/).length >= 3)).toBe(true)
  })

  it("highlights a premium bullet with preserved 15% and LATAM context", () => {
    const original = buildCvState({
      experience: [
        {
          title: "Senior Business Intelligence",
          company: "Grupo Positivo",
          location: "Curitiba",
          startDate: "01/2025",
          endDate: "04/2026",
          bullets: [
            "Aumentei em 15% os indicadores de qualidade de produção na LATAM com dashboards e governança de dados.",
          ],
        },
      ],
    })
    const optimized = buildCvState({
      experience: [
        {
          title: "Senior Business Intelligence",
          company: "Grupo Positivo",
          location: "Curitiba",
          startDate: "01/2025",
          endDate: "04/2026",
          bullets: [
            "Liderei dashboards estratégicos e governança analítica, contribuindo para aumento de 15% nos indicadores de qualidade de produção na LATAM.",
          ],
        },
      ],
    })

    const result = buildOptimizedPreviewHighlights(original, optimized)

    expect(result.experience[0]?.bullets[0]?.highlightWholeLine).toBe(true)
  })

  it("suppresses isolated single-word highlights with low standalone value", () => {
    const result = buildRelevantHighlightLine(
      "Atuei com times internos na operação.",
      "Atuei com times internos, cliente e operação.",
      "summary",
    )

    expect(result.segments.some((segment) => segment.highlighted && segment.text.includes("cliente"))).toBe(false)
  })

  it("does not highlight isolated technology names on their own", () => {
    const result = buildRelevantHighlightLine(
      "Experiência com dashboards corporativos.",
      "Experiência com dashboards corporativos, Microsoft.",
      "summary",
    )

    expect(result.segments.some((segment) => segment.highlighted && segment.text.includes("Microsoft"))).toBe(false)
  })

  it("highlights semantic chunks with complete meaning", () => {
    const result = buildRelevantHighlightLine(
      "Profissional com experiência em BI.",
      "Profissional com experiência em contextos de Business Intelligence.",
      "summary",
    )

    expect(result.segments.some((segment) => segment.highlighted && segment.text.includes("contextos de Business Intelligence"))).toBe(true)
  })

  it("keeps the summary from becoming excessively fragmented", () => {
    const result = buildRelevantHighlightLine(
      "Consultor de BI com dashboards e apoio a clientes.",
      "Consultor de BI com dashboards, apoio, cliente, consultoria, Senior Business Intelligence e continuidade operacional.",
      "summary",
    )

    const highlightedSegments = result.segments.filter((segment) => segment.highlighted)
    expect(highlightedSegments.length).toBeLessThanOrEqual(3)
    expect(highlightedSegments.some((segment) => segment.text.includes("Senior Business Intelligence"))).toBe(true)
    expect(highlightedSegments.some((segment) => segment.text.includes("continuidade operacional"))).toBe(true)
    expect(highlightedSegments.some((segment) => segment.text.trim() === "cliente")).toBe(false)
    expect(highlightedSegments.some((segment) => segment.text.trim() === "consultoria")).toBe(false)
  })
})
