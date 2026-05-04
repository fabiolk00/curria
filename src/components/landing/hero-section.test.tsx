import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

import HeroSection from "./hero-section"

vi.mock("@/components/landing/floating-decorations", () => ({
  FloatingDecorations: () => <div data-testid="floating-decorations" />,
}))

vi.mock("@/components/shared/before-after-comparison", () => ({
  BeforeAfterComparison: () => <div data-testid="before-after-comparison">Before/After</div>,
}))

describe("HeroSection", () => {
  it("renders the CTA block after the before/after comparison in the DOM and removes the scroll indicator", () => {
    render(<HeroSection />)

    const heading = screen.getByRole("heading", { level: 1 })
    const section = heading.closest("section")
    const comparison = screen.getByTestId("before-after-comparison")
    const primaryCta = screen.getByRole("link", { name: /analisar meu currículo grátis/i })
    const secondaryCta = screen.getByRole("link", { name: /ver como melhorar/i })

    expect(section).toHaveClass("pt-28")
    expect(section).toHaveClass("sm:pt-32")
    expect(section).toHaveClass("md:py-24")
    expect(heading).toHaveClass("text-center")
    expect(heading).toHaveClass("lg:text-left")
    expect(comparison.compareDocumentPosition(primaryCta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(comparison.compareDocumentPosition(secondaryCta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(primaryCta).toHaveAttribute("href", "/criar-conta")
    expect(screen.queryByText(/scroll para explorar/i)).not.toBeInTheDocument()
  })
})
