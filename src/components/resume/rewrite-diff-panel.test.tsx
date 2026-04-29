import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { describe, expect, it } from "vitest"

import { RewriteDiffPanel } from "./rewrite-diff-panel"
import type { RewriteChangeSummary } from "@/types/agent"

const changes: RewriteChangeSummary[] = [
  {
    id: "rewrite-change-summary",
    section: "summary",
    sectionLabel: "Resumo",
    changed: true,
    beforeText: "Engenheiro de Dados e Especialista em BI.",
    afterText: "Profissional com experiência em Engenharia de Dados e BI, Power BI, SQL e dashboards.",
    relatedJobRequirements: ["Power BI", "SQL", "dashboards"],
    changeReasons: [
      "Destacou requisito relevante da vaga: Power BI, SQL e dashboards.",
      "Aproximou a experiência das responsabilidades da vaga.",
    ],
    safetyNotes: [
      "Não adicionamos DAX como experiência direta porque não havia evidência suficiente no currículo original.",
    ],
    changeIntensity: "moderate",
  },
  {
    id: "rewrite-change-skills",
    section: "skills",
    sectionLabel: "Skills",
    changed: false,
    beforeText: "SQL, Power BI",
    afterText: "SQL, Power BI",
    relatedJobRequirements: [],
    changeReasons: [],
    safetyNotes: [],
    changeIntensity: "none",
  },
]

describe("RewriteDiffPanel", () => {
  it("renders changed sections and opens before/after details", async () => {
    const user = userEvent.setup()

    render(<RewriteDiffPanel changes={changes} />)

    expect(screen.getByText("Entenda o que mudou")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Resumo/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Skills/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Resumo/i }))

    expect(screen.getByText("Antes")).toBeInTheDocument()
    expect(screen.getByText("Depois")).toBeInTheDocument()
    expect(screen.getByText(/Engenheiro de Dados/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Power BI, SQL e dashboards/i).length).toBeGreaterThan(0)
    expect(screen.getByText("Por que mudou:")).toBeInTheDocument()
    expect(screen.getByText(/Destacou requisito relevante/i)).toBeInTheDocument()
    expect(screen.getByText(/Não adicionamos DAX/i)).toBeInTheDocument()
  })
})
