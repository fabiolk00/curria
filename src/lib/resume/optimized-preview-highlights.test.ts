import { describe, expect, it } from "vitest"

import type { CVState } from "@/types/cv"

import {
  type ExperienceBulletHighlightResult,
  buildOptimizedPreviewHighlights,
  buildRelevantHighlightLine,
  normalizePreviewSummaryText,
  selectVisibleExperienceHighlightsForEntry,
} from "./optimized-preview-highlights"

function buildCvState(input: Partial<CVState>): CVState {
  return {
    fullName: "Fabio Kroker",
    email: "fabio@example.com",
    phone: "555-0100",
    linkedin: "linkedin.com/in/fabiokroker",
    location: "Curitiba, Parana, Brazil",
    summary: "",
    experience: [],
    skills: [],
    education: [],
    certifications: [],
    ...input,
  }
}

function buildExperienceBulletHighlightResult(
  overrides: Partial<ExperienceBulletHighlightResult> & Pick<ExperienceBulletHighlightResult, "bullet" | "bulletIndex">,
): ExperienceBulletHighlightResult {
  const highlightTier = overrides.highlightTier ?? "strong"
  const highlightCategory = overrides.highlightCategory ?? "metric"
  const renderable = overrides.renderable ?? true

  return {
    bullet: overrides.bullet,
    bulletIndex: overrides.bulletIndex,
    line: renderable
      ? {
          segments: [
            {
              text: overrides.bullet,
              highlighted: true,
              evidenceTier: highlightTier,
              evidenceCategory: highlightCategory,
            },
          ],
          highlightWholeLine: false,
          highlightTier,
          highlightCategory,
        }
      : {
          segments: [{ text: overrides.bullet, highlighted: false }],
          highlightWholeLine: false,
        },
    eligible: overrides.eligible ?? true,
    hasVisibleHighlightCandidate: overrides.hasVisibleHighlightCandidate ?? renderable,
    renderable,
    improvementScore: overrides.improvementScore ?? 0,
    winnerScore: overrides.winnerScore ?? 0,
    highlightTier: renderable ? highlightTier : overrides.highlightTier,
    highlightCategory: renderable ? highlightCategory : overrides.highlightCategory,
  }
}

describe("optimized preview highlights", () => {
  describe("experience-entry surfacing policy", () => {
    it("prioritizes a Tier 1 metric bullet over a same-entry contextual stack bullet", () => {
      const selected = selectVisibleExperienceHighlightsForEntry([
        buildExperienceBulletHighlightResult({
          bullet: "Estruturei ETL, SQL e Power BI para governanca analitica.",
          bulletIndex: 0,
          highlightTier: "secondary",
          highlightCategory: "contextual_stack",
          improvementScore: 11,
          winnerScore: 10,
        }),
        buildExperienceBulletHighlightResult({
          bullet: "Reduzi o tempo de processamento em 18%.",
          bulletIndex: 1,
          highlightTier: "strong",
          highlightCategory: "metric",
          improvementScore: 6,
          winnerScore: 4,
        }),
      ])

      expect(selected).toHaveLength(2)
      expect(selected[0]?.highlightCategory).toBe("metric")
      expect(selected[1]?.highlightCategory).toBe("contextual_stack")
    })

    it("keeps two Tier 1 bullets ahead of Tier 2 under the entry cap", () => {
      const selected = selectVisibleExperienceHighlightsForEntry([
        buildExperienceBulletHighlightResult({
          bullet: "Estruturei ETL, SQL e Power BI para governanca analitica.",
          bulletIndex: 0,
          highlightTier: "secondary",
          highlightCategory: "contextual_stack",
          improvementScore: 14,
          winnerScore: 12,
        }),
        buildExperienceBulletHighlightResult({
          bullet: "Reduzi o tempo de processamento em 32%.",
          bulletIndex: 1,
          highlightTier: "strong",
          highlightCategory: "metric",
          improvementScore: 9,
          winnerScore: 8,
        }),
        buildExperienceBulletHighlightResult({
          bullet: "Gerenciei carteira regional com mais de 120 contas ativas.",
          bulletIndex: 2,
          highlightTier: "strong",
          highlightCategory: "scope_scale",
          improvementScore: 8,
          winnerScore: 7,
        }),
      ], 2)

      expect(selected).toHaveLength(2)
      expect(selected.map((entry) => entry.highlightCategory)).toEqual(["metric", "scope_scale"])
    })

    it("allows Tier 2 bullets to surface when Tier 1 evidence is absent", () => {
      const selected = selectVisibleExperienceHighlightsForEntry([
        buildExperienceBulletHighlightResult({
          bullet: "Estruturei ETL, SQL e Power BI para governanca analitica.",
          bulletIndex: 0,
          highlightTier: "secondary",
          highlightCategory: "contextual_stack",
          improvementScore: 8,
          winnerScore: 7,
        }),
        buildExperienceBulletHighlightResult({
          bullet: "Liderei a frente analitica para o time comercial.",
          bulletIndex: 1,
          highlightTier: "secondary",
          highlightCategory: "anchored_leadership",
          improvementScore: 9,
          winnerScore: 6,
        }),
      ], 1)

      expect(selected).toHaveLength(1)
      expect(selected[0]?.highlightCategory).toBe("contextual_stack")
    })

    it("does not force weak or non-renderable secondary bullets into empty capacity", () => {
      const selected = selectVisibleExperienceHighlightsForEntry([
        buildExperienceBulletHighlightResult({
          bullet: "Atuei com apoio analitico recorrente.",
          bulletIndex: 0,
          highlightTier: "secondary",
          highlightCategory: "anchored_outcome",
          eligible: true,
          renderable: false,
          hasVisibleHighlightCandidate: false,
          improvementScore: 4,
          winnerScore: 0,
        }),
      ])

      expect(selected).toHaveLength(0)
    })

    it("breaks same-rank ties deterministically by stable bullet order after score parity", () => {
      const selected = selectVisibleExperienceHighlightsForEntry([
        buildExperienceBulletHighlightResult({
          bullet: "Reduzi o tempo de processamento em 18%.",
          bulletIndex: 0,
          highlightTier: "strong",
          highlightCategory: "metric",
          improvementScore: 6,
          winnerScore: 5,
        }),
        buildExperienceBulletHighlightResult({
          bullet: "Reduzi o tempo de atendimento em 18%.",
          bulletIndex: 1,
          highlightTier: "strong",
          highlightCategory: "metric",
          improvementScore: 6,
          winnerScore: 5,
        }),
      ])

      expect(selected).toHaveLength(2)
      expect(selected.map((entry) => entry.bulletIndex)).toEqual([0, 1])
    })
  })

  it("does not highlight minor punctuation-only changes", () => {
    const result = buildRelevantHighlightLine(
      "Engenheiro de dados com foco em BI",
      "Engenheiro de dados com foco em BI.",
    )

    expect(result.segments.some((segment) => segment.highlighted)).toBe(false)
  })

  it("never applies semantic highlight markup to summary", () => {
    const result = buildRelevantHighlightLine(
      "Consultor de Business Intelligence com entrega de dashboards.",
      "Atuacao em Senior Business Intelligence com dashboards estrategicos.",
      "summary",
    )

    expect(result.highlightWholeLine).toBe(false)
    expect(result.segments.some((segment) => segment.highlighted)).toBe(false)
  })

  it("normalizes structured summary payloads to plain human-readable text", () => {
    expect(
      normalizePreviewSummaryText('{"section":"summary","profile":"Profissional de Business Intelligence e Engenharia de Dados."}'),
    ).toBe("Profissional de Business Intelligence e Engenharia de Dados.")
  })

  it("extracts summary text from malformed serialized payloads", () => {
    expect(
      normalizePreviewSummaryText('{"section":"summary","profile":"Profissional de BI com foco em SQL e ETL"'),
    ).toBe("Profissional de BI com foco em SQL e ETL")
  })

  it("does not highlight isolated skill-only tokens in experience", () => {
    const result = buildRelevantHighlightLine(
      "Experiencia com dashboards corporativos.",
      "Experiencia com dashboards corporativos, SQL.",
      "experience",
    )

    expect(result.segments.some((segment) => segment.highlighted && segment.text.includes("SQL"))).toBe(false)
  })

  it("highlights compact metric spans in experience bullets", () => {
    const bullet =
      "Liderei a reestruturacao da governanca analitica em escopo LATAM, reduzindo em 32% o tempo de publicacao de dashboards."
    const result = buildRelevantHighlightLine(
      "Criei dashboards e acompanhei indicadores da operacao.",
      bullet,
      "experience",
    )

    const highlightedSegments = result.segments.filter((segment) => segment.highlighted)
    const highlightedCharacters = highlightedSegments.reduce((total, segment) => total + segment.text.trim().length, 0)

    expect(result.highlightWholeLine).toBe(false)
    expect(highlightedSegments.length).toBeLessThanOrEqual(1)
    expect(highlightedSegments.length).toBeGreaterThan(0)
    expect(highlightedCharacters / bullet.length).toBeLessThan(0.3)
  })

  it("allows ATS-relevant skill clusters inside meaningful highlighted spans", () => {
    const result = buildRelevantHighlightLine(
      "Atuei com relatorios internos e rotina de acompanhamento.",
      "Estruturei ETL, SQL e Power BI para governanca analitica.",
      "experience",
    )

    const highlightedSegments = result.segments.filter((segment) => segment.highlighted)

    expect(highlightedSegments.length).toBeLessThanOrEqual(1)
    expect(highlightedSegments.some((segment) => segment.text.includes("ETL, SQL e Power BI"))).toBe(true)
    expect(highlightedSegments[0]?.evidenceCategory).toBe("contextual_stack")
    expect(highlightedSegments[0]?.evidenceTier).toBe("secondary")
    expect(result.highlightCategory).toBe("contextual_stack")
    expect(result.highlightTier).toBe("secondary")
  })

  it("favors structural metric evidence over narrative phrasing when both are present", () => {
    const result = buildRelevantHighlightLine(
      "Atuei com melhoria continua na operacao.",
      "Melhorei a eficiencia do processo, reduzindo em 27% o tempo de atendimento.",
      "experience",
    )

    const highlightedSegments = result.segments.filter((segment) => segment.highlighted)

    expect(highlightedSegments).toHaveLength(1)
    expect(highlightedSegments[0]?.text).toContain("27%")
    expect(highlightedSegments[0]?.text).not.toContain("Melhorei a eficiencia")
    expect(highlightedSegments[0]?.evidenceCategory).toBe("metric")
    expect(highlightedSegments[0]?.evidenceTier).toBe("strong")
    expect(result.highlightCategory).toBe("metric")
    expect(result.highlightTier).toBe("strong")
  })

  it("prefers explicit scope or scale over generic leadership phrasing", () => {
    const result = buildRelevantHighlightLine(
      "Coordenei rotinas internas do time.",
      "Coordenei a frente analitica em escopo global para multiplas operacoes.",
      "experience",
    )

    const highlightedSegments = result.segments.filter((segment) => segment.highlighted)

    expect(highlightedSegments).toHaveLength(1)
    expect(highlightedSegments[0]?.text.toLowerCase()).toMatch(/global|multiplas/)
  })

  it("does not highlight abstract narrative outcomes without structural anchors", () => {
    const result = buildRelevantHighlightLine(
      "Apoiei o time com demandas internas.",
      "Melhorei a colaboracao entre areas e gerei mais alinhamento estrategico.",
      "experience",
    )

    expect(result.segments.some((segment) => segment.highlighted)).toBe(false)
  })

  it("selects the rendered experience span from optimized structural evidence instead of the closest diff fragment", () => {
    const result = buildRelevantHighlightLine(
      "Liderei dashboards estrategicos com governanca analitica.",
      "Liderei dashboards estrategicos com governanca analitica, reduzindo em 32% o tempo de publicacao.",
      "experience",
    )

    const highlightedSegments = result.segments.filter((segment) => segment.highlighted)

    expect(highlightedSegments).toHaveLength(1)
    expect(highlightedSegments[0]?.text).toContain("32%")
  })

  it("allows zero highlight when the bullet changed but no strong optimized structural span exists", () => {
    const original = buildCvState({
      experience: [
        {
          title: "Analista de BI",
          company: "Acme",
          location: "Curitiba",
          startDate: "01/2024",
          endDate: "04/2026",
          bullets: [
            "Criei dashboards para o time.",
            "Monitorei indicadores internos.",
          ],
        },
      ],
    })
    const optimized = buildCvState({
      experience: [
        {
          title: "Analista de BI",
          company: "Acme",
          location: "Curitiba",
          startDate: "01/2024",
          endDate: "04/2026",
          bullets: [
            "Atuei de forma colaborativa com diferentes stakeholders do negocio.",
            "Monitorei indicadores internos.",
          ],
        },
      ],
    })

    const result = buildOptimizedPreviewHighlights(original, optimized)

    expect(
      result.experience[0]?.bullets[0]?.segments.some((segment) => segment.highlighted),
    ).toBe(false)
    expect(result.experience[0]?.bullets[0]?.highlightCategory).toBeUndefined()
    expect(result.experience[0]?.bullets[0]?.highlightTier).toBeUndefined()
  })

  it("recovers obvious contextual stack clusters when they are the strongest available evidence", () => {
    const result = buildRelevantHighlightLine(
      "Criei relatorios para acompanhamento operacional.",
      "Utilizando dbt, SQL e Power BI para governanca analitica recorrente.",
      "experience",
    )

    const highlightedSegments = result.segments.filter((segment) => segment.highlighted)

    expect(highlightedSegments).toHaveLength(1)
    expect(highlightedSegments[0]?.text).toContain("dbt, SQL e Power BI")
  })

  it("trims weak trailing connectors from rendered experience spans", () => {
    const result = buildRelevantHighlightLine(
      "Coordenei rotinas locais do time.",
      "Coordenei a frente analitica em escopo global para o time comercial.",
      "experience",
    )

    const highlightedSegment = result.segments.find((segment) => segment.highlighted)

    expect(highlightedSegment).toBeDefined()
    expect(highlightedSegment?.text.toLowerCase()).not.toMatch(/\b(com|para|de|da|do|das|dos|em|ao|a|o|e)\s*$/)
  })

  it("expands compact metric winners into a more complete evidence phrase", () => {
    const result = buildRelevantHighlightLine(
      "Experiencia base antiga.",
      "Otimizei pipelines ETL no Databricks e reduzi o tempo de processamento em 40%.",
      "experience",
    )

    const highlightedSegment = result.segments.find((segment) => segment.highlighted)

    expect(highlightedSegment).toBeDefined()
    expect(highlightedSegment?.text).toContain("tempo de processamento em 40%")
    expect(highlightedSegment?.text).not.toContain("Otimizei pipelines")
  })

  it("expands compact scope and scale winners into a more complete evidence phrase", () => {
    const result = buildRelevantHighlightLine(
      "Coordenei rotinas internas do time.",
      "Coordenei a frente analitica em escopo global para multiplas operacoes.",
      "experience",
    )

    const highlightedSegment = result.segments.find((segment) => segment.highlighted)

    expect(highlightedSegment).toBeDefined()
    expect(highlightedSegment?.text).toBe("escopo global para multiplas operacoes")
  })

  it("makes compact metric and scope evidence slightly more complete without over-expanding", () => {
    const result = buildRelevantHighlightLine(
      "Consolidei bases para analise operacional.",
      "Integrei mais de 40 fontes de dados para governanca analitica.",
      "experience",
    )

    const highlightedSegment = result.segments.find((segment) => segment.highlighted)

    expect(highlightedSegment).toBeDefined()
    expect(highlightedSegment?.text).toContain("mais de 40")
    expect(highlightedSegment?.text).toContain("fontes")
    expect(highlightedSegment?.text.length ?? 0).toBeLessThan("mais de 40 fontes de dados para governanca analitica.".length)
  })

  it("keeps metric and scope expansion bounded instead of drifting into narrative phrasing", () => {
    const result = buildRelevantHighlightLine(
      "Aumentei em 15% os indicadores de qualidade de producao na LATAM com dashboards em Power BI.",
      "Liderei dashboards estrategicos e governanca analitica, contribuindo para aumento de 15% nos indicadores de qualidade de producao na LATAM.",
      "experience",
    )

    const highlightedSegment = result.segments.find((segment) => segment.highlighted)

    expect(highlightedSegment).toBeDefined()
    expect(highlightedSegment?.text).toContain("15%")
    expect(highlightedSegment?.text).not.toContain("Liderei dashboards estrategicos")
    expect((highlightedSegment?.text.length ?? 0) / "Liderei dashboards estrategicos e governanca analitica, contribuindo para aumento de 15% nos indicadores de qualidade de producao na LATAM.".length).toBeLessThan(0.45)
  })

  it("keeps zero highlight for weak narrative bullets after the completeness tuning", () => {
    const result = buildRelevantHighlightLine(
      "Apoiei a equipe em demandas recorrentes.",
      "Atuei em parceria com diferentes areas para ampliar alinhamento interno.",
      "experience",
    )

    expect(result.segments.some((segment) => segment.highlighted)).toBe(false)
  })

  it("generalizes metric completion for a sales-style percentage phrase", () => {
    const result = buildRelevantHighlightLine(
      "Acompanhei a carteira comercial e apoiei o time de vendas.",
      "Reduzi em 18% o ciclo de fechamento de contratos enterprise.",
      "experience",
    )

    const highlightedSegment = result.segments.find((segment) => segment.highlighted)

    expect(highlightedSegment).toBeDefined()
    expect(highlightedSegment?.text).toContain("18%")
    expect(highlightedSegment?.text).toContain("ciclo de fechamento")
    expect(highlightedSegment?.text).not.toContain("Acompanhei")
  })

  it("generalizes metric completion for a healthcare-style wait-time phrase", () => {
    const result = buildRelevantHighlightLine(
      "Apoiei rotinas da clinica e acompanhamentos internos.",
      "Reduzi o tempo de espera em 22% no fluxo de triagem ambulatorial.",
      "experience",
    )

    const highlightedSegment = result.segments.find((segment) => segment.highlighted)

    expect(highlightedSegment).toBeDefined()
    expect(highlightedSegment?.text).toBe("tempo de espera em 22%")
  })

  it("generalizes metric completion for a customer-success currency phrase", () => {
    const result = buildRelevantHighlightLine(
      "Apoiei a jornada de clientes com contatos recorrentes.",
      "Aumentei em R$ 180 mil a receita de expansao da base ativa.",
      "experience",
    )

    const highlightedSegment = result.segments.find((segment) => segment.highlighted)

    expect(highlightedSegment).toBeDefined()
    expect(highlightedSegment?.text).toContain("R$ 180 mil")
    expect(highlightedSegment?.text).toContain("receita")
    expect(highlightedSegment?.text).not.toContain("Aumentei")
  })

  it("generalizes scope and scale completion for an operations-style volume phrase", () => {
    const result = buildRelevantHighlightLine(
      "Acompanhei rotinas logisticas e controles operacionais.",
      "Liderei operacao nacional com alto volume de entregas diarias.",
      "experience",
    )

    const highlightedSegment = result.segments.find((segment) => segment.highlighted)

    expect(highlightedSegment).toBeDefined()
    expect(highlightedSegment?.text).toBe("operacao nacional com alto volume de entregas")
  })

  it("generalizes scope and scale completion for a sales-style account volume phrase", () => {
    const result = buildRelevantHighlightLine(
      "Atendi clientes estrategicos da operacao.",
      "Gerenciei carteira regional com mais de 120 contas ativas.",
      "experience",
    )

    const highlightedSegment = result.segments.find((segment) => segment.highlighted)

    expect(highlightedSegment).toBeDefined()
    expect(highlightedSegment?.text).toBe("mais de 120 contas ativas")
  })

  it("preserves zero highlight for weak education-style narrative bullets", () => {
    const result = buildRelevantHighlightLine(
      "Ministrei aulas e acompanhei o desenvolvimento das turmas.",
      "Atuei de forma colaborativa com docentes e coordenacao pedagogica.",
      "experience",
    )

    expect(result.segments.some((segment) => segment.highlighted)).toBe(false)
  })

  it("caps highlighted bullets per experience entry", () => {
    const original = buildCvState({
      experience: [
        {
          title: "Senior Business Intelligence",
          company: "Grupo Positivo",
          location: "Curitiba",
          startDate: "01/2025",
          endDate: "04/2026",
          bullets: [
            "Criei dashboards para a operacao.",
            "Monitorei indicadores da area.",
            "Apoiei analises pontuais para o time.",
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
            "Liderei ETL, SQL e Power BI para governanca analitica.",
            "Contribui para aumento de 15% nos indicadores em escopo LATAM.",
            "Apoiei iniciativas de BI para o time.",
          ],
        },
      ],
    })

    const result = buildOptimizedPreviewHighlights(original, optimized)
    const highlightedBullets = result.experience[0]?.bullets.filter((bullet) =>
      bullet.segments.some((segment) => segment.highlighted),
    ) ?? []

    expect(highlightedBullets.length).toBeLessThanOrEqual(2)
  })

  it("surfaces two same-entry Tier 1 bullets before a Tier 2 bullet in the real preview pipeline", () => {
    const original = buildCvState({
      experience: [
        {
          title: "Senior Business Intelligence",
          company: "Grupo Positivo",
          location: "Curitiba",
          startDate: "01/2025",
          endDate: "04/2026",
          bullets: [
            "Criei dashboards para a operacao.",
            "Monitorei indicadores da area.",
            "Apoiei analises pontuais para o time.",
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
            "Estruturei ETL, SQL e Power BI para governanca analitica.",
            "Reduzi o tempo de processamento em 32%.",
            "Gerenciei carteira regional com mais de 120 contas ativas.",
          ],
        },
      ],
    })

    const result = buildOptimizedPreviewHighlights(original, optimized)
    const bullets = result.experience[0]?.bullets ?? []

    expect(bullets[0]?.segments.some((segment) => segment.highlighted)).toBe(false)
    expect(bullets[1]?.highlightTier).toBe("strong")
    expect(bullets[1]?.highlightCategory).toBe("metric")
    expect(bullets[2]?.highlightTier).toBe("strong")
    expect(bullets[2]?.highlightCategory).toBe("scope_scale")
  })
})
