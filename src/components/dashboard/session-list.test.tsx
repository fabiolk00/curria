import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import SessionList from "./session-list"

describe("SessionList", () => {
  it("renders the estimated ATS Readiness range with pt-BR badge copy", () => {
    render(
      <SessionList
        sessions={[
          {
            id: "sess_123",
            phase: "dialog",
            createdAt: "21 abr 2026",
            atsReadiness: {
              displayedReadinessScoreCurrent: 89,
              display: {
                mode: "estimated_range",
                scoreStatus: "estimated_range",
                exactScore: null,
                estimatedRangeMin: 89,
                estimatedRangeMax: 91,
                confidence: "low",
                labelPtBr: "ATS Readiness Score",
                badgeTextPtBr: "Estimado",
                helperTextPtBr: "Faixa estimada com base na otimização concluída.",
                formattedScorePtBr: "89–91",
              },
            },
          },
        ]}
      />,
    )

    expect(screen.getByText("ATS Readiness Score: 89–91")).toBeInTheDocument()
    expect(screen.getByText("Estimado")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Explicação do score estimado" })).toBeInTheDocument()
    expect(screen.getByRole("link")).toHaveAttribute("href", "/dashboard/resume/compare/sess_123")
  })

})


