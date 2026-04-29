import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, expect, it } from "vitest"

import { PLANS, formatPrice } from "@/lib/plans"

import PricingComparisonTable from "./pricing-comparison-table"

describe("PricingComparisonTable", () => {
  it("renders Monthly and Pro using canonical plan values", () => {
    render(<PricingComparisonTable />)

    expect(screen.getByText(formatPrice(PLANS.monthly.price))).toBeInTheDocument()
    expect(screen.getByText(formatPrice(PLANS.pro.price))).toBeInTheDocument()
    expect(screen.getByText(String(PLANS.monthly.credits))).toBeInTheDocument()
    expect(screen.getByText(String(PLANS.pro.credits))).toBeInTheDocument()
    expect(screen.queryByText("R$ 69,90")).not.toBeInTheDocument()
  })

  it("does not advertise retired formats or chat in the pricing table", () => {
    render(<PricingComparisonTable />)

    const chatLabelPattern = new RegExp(["Chat", "com IA"].join(" "), "i")
    const retiredFormatPattern = new RegExp(["DO", "CX"].join(""), "i")

    expect(screen.queryByText(chatLabelPattern)).not.toBeInTheDocument()
    expect(screen.queryByText(retiredFormatPattern)).not.toBeInTheDocument()
  })
})
