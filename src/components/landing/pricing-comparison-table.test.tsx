import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, expect, it } from "vitest"

import { PLAN_DISPLAY_ORDER } from "@/lib/pricing/plan-comparison"
import { PLANS, formatPrice } from "@/lib/plans"

import PricingComparisonTable from "./pricing-comparison-table"

describe("PricingComparisonTable", () => {
  it("renders the current canonical plans and prices in a detailed comparison table", () => {
    render(<PricingComparisonTable />)

    expect(screen.getByText("Compare os planos")).toBeInTheDocument()
    expect(screen.getByLabelText("Ciclo de cobrança")).toHaveTextContent("Planos atuais")
    expect(screen.getByLabelText("Ciclo de cobrança")).toHaveTextContent("Único e mensal")

    for (const slug of PLAN_DISPLAY_ORDER) {
      expect(screen.getAllByText(PLANS[slug].name).length).toBeGreaterThan(0)
      expect(screen.getAllByText(new RegExp(formatPrice(PLANS[slug].price).replace("R$ ", "R\\$\\s?"))).length).toBeGreaterThan(0)
      expect(screen.getAllByText(String(PLANS[slug].credits)).length).toBeGreaterThan(0)
    }

    expect(screen.getAllByLabelText("Mais informações sobre Preço")).toHaveLength(1)
    expect(screen.getAllByLabelText("Mais informações sobre Currículos")).toHaveLength(1)
    expect(screen.getAllByLabelText("PDF: incluído")).toHaveLength(3)
    expect(screen.getAllByLabelText("PDF: não incluído")).toHaveLength(1)
    expect(screen.getAllByLabelText("Histórico: incluído")).toHaveLength(3)
    expect(screen.getAllByLabelText("Histórico: não incluído")).toHaveLength(1)
    expect(screen.queryByText("R$ 69,90")).not.toBeInTheDocument()
  })

  it("does not advertise retired formats, chat, or unavailable plan names", () => {
    render(<PricingComparisonTable />)

    const chatLabelPattern = new RegExp(["Chat", "com IA"].join(" "), "i")
    const retiredFormatPattern = new RegExp(["DO", "CX"].join(""), "i")

    expect(screen.queryByText(chatLabelPattern)).not.toBeInTheDocument()
    expect(screen.queryByText(retiredFormatPattern)).not.toBeInTheDocument()
    expect(screen.queryByText("Enterprise")).not.toBeInTheDocument()
    expect(screen.queryByText("Plus")).not.toBeInTheDocument()
  })
})
