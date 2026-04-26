import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

import PricingSection from "./pricing-section"

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock("@/components/landing/pricing-comparison-table", () => ({
  default: () => <div data-testid="pricing-comparison-table-component">Comparison Table</div>,
}))

describe("PricingSection", () => {
  it("uses the same included and excluded resource signaling as the comparison table, hides it on mobile, and sends CTAs to signup", () => {
    render(<PricingSection />)

    expect(screen.getByTestId("landing-pricing-comparison")).toHaveClass("hidden")
    expect(screen.getByTestId("landing-pricing-comparison")).toHaveClass("md:block")
    expect(screen.getByTestId("pricing-comparison-table-component")).toBeInTheDocument()
    expect(screen.getAllByText("Currículos")).toHaveLength(4)
    expect(screen.getAllByText("ATS Expert")).toHaveLength(4)
    expect(screen.getAllByLabelText("PDF: incluído")).toHaveLength(3)
    expect(screen.getAllByLabelText("PDF: não incluído")).toHaveLength(1)
    expect(screen.getAllByLabelText("Chat com IA: incluído")).toHaveLength(1)
    expect(screen.getAllByLabelText("Chat com IA: não incluído")).toHaveLength(3)
    expect(screen.getAllByLabelText("Histórico: incluído")).toHaveLength(3)
    expect(screen.getAllByLabelText("Histórico: não incluído")).toHaveLength(1)
    expect(screen.queryByText("Incluído")).not.toBeInTheDocument()
    expect(screen.queryByText("Não")).not.toBeInTheDocument()

    const ctas = screen.getAllByRole("link", { name: /começar agora/i })
    expect(ctas).toHaveLength(4)
    expect(ctas.every((link) => link.getAttribute("href") === "/criar-conta")).toBe(true)
  })
})
