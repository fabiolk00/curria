import React from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import SessionsPage from "./page"

vi.mock("@/lib/billing/ai-chat-access.server", () => ({
  getAiChatAccess: () => {
    throw new Error("session history must not load AI chat entitlement")
  },
}))

vi.mock("@/components/dashboard/sessions-list", () => ({
  SessionsList: () => <div data-testid="sessions-list">Generated resume history</div>,
}))

describe("SessionsPage", () => {
  it("renders generated resume history without AI chat entitlement", async () => {
    const jsx = await SessionsPage()
    render(jsx)

    expect(screen.getByRole("heading", { name: "Histórico de currículos" })).toBeInTheDocument()
    expect(screen.getByTestId("sessions-list")).toBeInTheDocument()
  })
})
