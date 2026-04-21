import { describe, expect, it } from "vitest"

import type { CVState } from "@/types/cv"

import {
  MAX_HIGHLIGHTED_BULLETS_PER_EXPERIENCE_ENTRY,
  MAX_HIGHLIGHTED_SPANS_PER_EXPERIENCE_BULLET,
  SUMMARY_SEMANTIC_HIGHLIGHT_ENABLED,
  buildOptimizedPreviewHighlights,
  buildRelevantHighlightLine,
  normalizePreviewSummaryText,
} from "./optimized-preview-highlights"

function buildCvState(input: Partial<CVState>): CVState {
  return {
    fullName: "Ana Silva",
    email: "ana@example.com",
    phone: "555-0100",
    linkedin: "linkedin.com/in/anasilva",
    location: "Sao Paulo, Brazil",
    summary: "",
    experience: [],
    skills: [],
    education: [],
    certifications: [],
    ...input,
  }
}

describe("ATS enhancement preview contracts", () => {
  it("Contract 1: summary never uses semantic highlight", () => {
    expect(SUMMARY_SEMANTIC_HIGHLIGHT_ENABLED).toBe(false)

    const result = buildRelevantHighlightLine(
      "Analista de dados com foco em BI.",
      "Especialista em BI e dados com foco em SQL e Power BI.",
      "summary",
    )

    expect(result.highlightWholeLine).toBe(false)
    expect(result.segments.some((segment) => segment.highlighted)).toBe(false)
  })

  it("Contract 2: summary never renders structured payload or raw JSON", () => {
    expect(
      normalizePreviewSummaryText('{"section":"summary","profile":"Profissional de BI com foco em SQL e ETL."}'),
    ).toBe("Profissional de BI com foco em SQL e ETL.")

    expect(
      normalizePreviewSummaryText({
        section: "summary",
        items: [
          { type: "text", content: "Profissional de BI." },
          { type: "text", profile: "Experiencia com SQL e Power BI." },
        ],
      }),
    ).toBe("Profissional de BI. Experiencia com SQL e Power BI.")
  })

  it("Contract 3: experience never uses full-line highlight", () => {
    const result = buildRelevantHighlightLine(
      "Criei dashboards e relatorios internos.",
      "Liderei dashboards estrategicos em escopo LATAM, reduzindo em 20% o tempo de reporte.",
      "experience",
    )

    expect(result.highlightWholeLine).toBe(false)
  })

  it("Contract 4: experience allows at most 1 highlighted span per bullet", () => {
    const result = buildRelevantHighlightLine(
      "Apoiei o time com relatorios internos.",
      "Estruturei ETL, SQL e Power BI para governanca analitica.",
      "experience",
    )

    const highlightedSegments = result.segments.filter((segment) => segment.highlighted)

    expect(highlightedSegments.length).toBeLessThanOrEqual(MAX_HIGHLIGHTED_SPANS_PER_EXPERIENCE_BULLET)
  })

  it("Contract 5: experience allows at most 2 highlighted bullets per entry", () => {
    const original = buildCvState({
      experience: [
        {
          title: "Senior BI Analyst",
          company: "Acme",
          startDate: "2022",
          endDate: "2024",
          bullets: [
            "Criei dashboards.",
            "Apoiei relatorios internos.",
            "Monitorei indicadores operacionais.",
          ],
        },
      ],
    })
    const optimized = buildCvState({
      experience: [
        {
          title: "Senior BI Analyst",
          company: "Acme",
          startDate: "2022",
          endDate: "2024",
          bullets: [
            "Liderei ETL, SQL e Power BI para governanca analitica.",
            "Contribui para aumento de 15% nos indicadores em escopo LATAM.",
            "Estruturei dashboards para a operacao global.",
          ],
        },
      ],
    })

    const result = buildOptimizedPreviewHighlights(original, optimized)
    const highlightedBullets = result.experience[0]?.bullets.filter((bullet) =>
      bullet.segments.some((segment) => segment.highlighted),
    ) ?? []

    expect(highlightedBullets.length).toBeLessThanOrEqual(MAX_HIGHLIGHTED_BULLETS_PER_EXPERIENCE_ENTRY)
  })

  it("Contract 6: ATS-relevant inline skills remain highlight-eligible only when contextual", () => {
    const isolated = buildRelevantHighlightLine(
      "Experiencia com dashboards corporativos.",
      "Experiencia com dashboards corporativos, SQL.",
      "experience",
    )
    const contextual = buildRelevantHighlightLine(
      "Atuei com relatorios internos e rotina de acompanhamento.",
      "Estruturei ETL, SQL e Power BI para governanca analitica.",
      "experience",
    )

    expect(isolated.segments.some((segment) => segment.highlighted && segment.text.includes("SQL"))).toBe(false)
    expect(contextual.segments.some((segment) => segment.highlighted && segment.text.includes("ETL, SQL e Power BI"))).toBe(true)
  })
})
