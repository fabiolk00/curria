import React from "react"
import { render, screen, within } from "@testing-library/react"
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
  it("renders canonical plan cards, recommendation state, and plan-specific CTAs", () => {
    render(<PricingSection />)

    expect(screen.getByTestId("pricing-comparison-table-component")).toBeInTheDocument()
    expect(screen.getByTestId("landing-pricing-comparison")).not.toHaveClass("hidden")
    expect(screen.getByTestId("pricing-card-free")).toHaveAttribute("data-featured", "false")
    expect(screen.getByTestId("pricing-card-unit")).toHaveAttribute("data-featured", "false")
    expect(screen.getByTestId("pricing-card-monthly")).toHaveAttribute("data-featured", "true")
    expect(screen.getByTestId("pricing-card-pro")).toHaveAttribute("data-featured", "false")
    expect(screen.getByText("Recomendado")).toBeInTheDocument()
    expect(screen.getByText("R$ 0")).toBeInTheDocument()
    expect(screen.getByText("R$ 19,90")).toBeInTheDocument()
    expect(screen.getByText("R$ 39,90")).toBeInTheDocument()
    expect(screen.getByText("R$ 59,90")).toBeInTheDocument()

    const chatLabelPattern = new RegExp(["Chat", "com IA"].join(" "), "i")
    const retiredFormatPattern = new RegExp(["DO", "CX"].join(""), "i")

    expect(screen.queryByText(chatLabelPattern)).not.toBeInTheDocument()
    expect(screen.queryByText(retiredFormatPattern)).not.toBeInTheDocument()
    expect(screen.queryByText("Enterprise")).not.toBeInTheDocument()
    expect(screen.queryByText("Plus")).not.toBeInTheDocument()

    expect(
      within(screen.getByTestId("pricing-card-free")).getByRole("link", { name: "Começar com este plano" }),
    ).toHaveAttribute("href", "/criar-conta")
    expect(
      within(screen.getByTestId("pricing-card-unit")).getByRole("link", { name: "Começar com este plano" }),
    ).toHaveAttribute("href", "/finalizar-compra?plan=unit")
    expect(
      within(screen.getByTestId("pricing-card-monthly")).getByRole("link", { name: "Começar com este plano" }),
    ).toHaveAttribute("href", "/finalizar-compra?plan=monthly")
    expect(
      within(screen.getByTestId("pricing-card-pro")).getByRole("link", { name: "Começar com este plano" }),
    ).toHaveAttribute("href", "/finalizar-compra?plan=pro")
  })
})
