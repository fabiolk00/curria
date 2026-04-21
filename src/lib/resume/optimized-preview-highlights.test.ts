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

  it("highlights relevant added keywords and seniority in summary text", () => {
    const result = buildRelevantHighlightLine(
      "Consultor de Business Intelligence com entrega de dashboards.",
      "Atuação em Senior Business Intelligence, Consultor de Business Intelligence e Desenvolvedor de Business Intelligence, com entrega de dashboards.",
    )

    expect(result.segments.some((segment) => segment.highlighted && segment.text.includes("Senior"))).toBe(true)
    expect(result.segments.some((segment) => segment.highlighted && segment.text.includes("Desenvolvedor"))).toBe(true)
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

  it("does not turn every tiny text change into a highlighted summary", () => {
    const result = buildRelevantHighlightLine(
      "Especialista em dados e BI",
      "Especialista em dados e BI com atuação técnica",
    )

    const highlightedSegments = result.segments.filter((segment) => segment.highlighted)
    expect(highlightedSegments.length).toBeLessThanOrEqual(2)
    expect(highlightedSegments.map((segment) => segment.text).join("")).not.toContain("Especialista em dados e BI")
  })
})
