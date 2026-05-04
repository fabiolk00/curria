import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, expect, it } from "vitest"

import { JobTargetingScoreCard } from "./job-targeting-score-card"

describe("JobTargetingScoreCard", () => {
  it("renders score bars and critical gaps", () => {
    render(
      <JobTargetingScoreCard
        breakdown={{
          total: 72,
          technicalScore: 72,
          displayScore: 72,
          maxTotal: 100,
          items: [
            { id: "skills", label: "Habilidades", score: 82, max: 100 },
            { id: "experience", label: "Experiência", score: 61, max: 100 },
            { id: "education", label: "Formação", score: 90, max: 100 },
          ],
          criticalGaps: ["P&L, margem, faturamento, forecast e budget"],
          gapPresentation: {
            criticalGroups: [{
              title: "Experiência de domínio não evidenciada",
              items: ["P&L, margem, faturamento, forecast e budget"],
            }],
            reviewNeededGroups: [],
          },
        }}
      />,
    )

    expect(screen.getByTestId("job-targeting-score-card")).toHaveClass("rounded-xl", "shadow-sm")
    expect(screen.getByText("Compatibilidade com a vaga")).toHaveClass("text-xl", "font-bold", "leading-tight")
    expect(screen.getByText("Composição da nota")).toBeInTheDocument()
    expect(screen.getByText("72")).toBeInTheDocument()
    expect(screen.getByLabelText("Nota de Habilidades")).toHaveAttribute("aria-valuenow", "82")
    expect(screen.getByLabelText("Nota de Experiência")).toHaveAttribute("aria-valuenow", "61")
    expect(screen.getByLabelText("Nota de Formação")).toHaveAttribute("aria-valuenow", "90")
    expect(screen.getByText("Gaps críticos")).toBeInTheDocument()
    expect(screen.getByText("Experiência de domínio não evidenciada")).toBeInTheDocument()
    expect(screen.getByText("P&L, margem, faturamento, forecast e budget")).toBeInTheDocument()
  })

  it("renders the very-low label and caps fallback gaps", () => {
    render(
      <JobTargetingScoreCard
        breakdown={{
          total: 0,
          technicalScore: 0,
          displayScore: 5,
          scoreLabel: "Aderência muito baixa",
          maxTotal: 100,
          items: [
            { id: "skills", label: "Habilidades", score: 0, max: 100 },
            { id: "experience", label: "Experiência", score: 0, max: 100 },
            { id: "education", label: "Formação", score: 0, max: 100 },
          ],
          criticalGaps: ["Gap 1", "Gap 2", "Gap 3", "Gap 4", "Gap 5", "Gap 6"],
        }}
      />,
    )

    expect(screen.getByText("Aderência muito baixa")).toBeInTheDocument()
    expect(screen.getByText("Técnico: 0/100")).toBeInTheDocument()
    expect(screen.getByText("Gap 5")).toBeInTheDocument()
    expect(screen.queryByText("Gap 6")).not.toBeInTheDocument()
  })
})
