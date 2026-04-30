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
          maxTotal: 100,
          items: [
            { id: "skills", label: "Habilidades", score: 82, max: 100 },
            { id: "experience", label: "Experiência", score: 61, max: 100 },
            { id: "education", label: "Formação", score: 90, max: 100 },
          ],
          criticalGaps: ["P&L, margem, faturamento, forecast e budget"],
        }}
      />,
    )

    expect(screen.getByText("Composição da nota")).toBeInTheDocument()
    expect(screen.getByText("72")).toBeInTheDocument()
    expect(screen.getByLabelText("Nota de Habilidades")).toHaveAttribute("aria-valuenow", "82")
    expect(screen.getByLabelText("Nota de Experiência")).toHaveAttribute("aria-valuenow", "61")
    expect(screen.getByLabelText("Nota de Formação")).toHaveAttribute("aria-valuenow", "90")
    expect(screen.getByText("Gaps críticos")).toBeInTheDocument()
    expect(screen.getByText("P&L, margem, faturamento, forecast e budget")).toBeInTheDocument()
  })
})
