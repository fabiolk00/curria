import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { describe, expect, it } from "vitest"

import {
  AtsReadinessStatusBadge,
  ESTIMATED_TOOLTIP_TEXT,
} from "./ats-readiness-status-badge"

describe("AtsReadinessStatusBadge", () => {
  it("shows the help icon only for the estimated state", () => {
    const { rerender } = render(<AtsReadinessStatusBadge badgeText="Estimado" />)

    expect(screen.getByText("Estimado")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Explicação do score estimado" })).toBeInTheDocument()

    rerender(<AtsReadinessStatusBadge badgeText="Final" />)

    expect(screen.getByText("Final")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Explicação do score estimado" })).not.toBeInTheDocument()
  })

  it("shows the tooltip text on hover, focus, and click", async () => {
    render(<AtsReadinessStatusBadge badgeText="Estimado" />)

    const helpButton = screen.getByRole("button", { name: "Explicação do score estimado" })

    await userEvent.hover(helpButton)
    expect((await screen.findAllByText(ESTIMATED_TOOLTIP_TEXT)).length).toBeGreaterThan(0)

    helpButton.focus()
    expect((await screen.findAllByText(ESTIMATED_TOOLTIP_TEXT)).length).toBeGreaterThan(0)

    await userEvent.click(helpButton)
    const tooltipCopies = await screen.findAllByText(ESTIMATED_TOOLTIP_TEXT)
    expect(tooltipCopies.length).toBeGreaterThan(0)
    expect(tooltipCopies[0]).toHaveClass("max-w-[180px]", "px-2.5", "py-1.5", "text-[10px]")
  })
})

