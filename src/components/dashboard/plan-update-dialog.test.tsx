import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

import { ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE, CHECKOUT_ERROR_MESSAGE } from "@/lib/asaas/checkout-errors"

import { PlanUpdateDialog } from "./plan-update-dialog"

const { mockNavigateToUrl, mockToastError, mockToastInfo, mockFetch } = vi.hoisted(() => ({
  mockNavigateToUrl: vi.fn(),
  mockToastError: vi.fn(),
  mockToastInfo: vi.fn(),
  mockFetch: vi.fn(),
}))

vi.mock("@/lib/navigation/external", () => ({
  navigateToUrl: mockNavigateToUrl,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    info: mockToastInfo,
  },
}))

describe("PlanUpdateDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", mockFetch)
  })

  it("renders pricing-style plan cards inside the modal", () => {
    render(
      <PlanUpdateDialog
        isOpen
        onOpenChange={vi.fn()}
        activeRecurringPlan={null}
        currentCredits={4}
      />,
    )

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Atualização de plano")).toBeInTheDocument()
    expect(screen.getByText("Mais popular")).toBeInTheDocument()
    expect(screen.getByText("Créditos atuais: 4")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Selecionar" })).toHaveLength(3)
  })

  it("retries once after a transient checkout error before redirecting", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal server error" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ url: "https://sandbox.asaas.com/payment-link/retry-success" }),
      })

    render(
      <PlanUpdateDialog
        isOpen
        onOpenChange={onOpenChange}
        activeRecurringPlan={null}
        currentCredits={4}
      />,
    )

    await user.click(screen.getAllByRole("button", { name: "Selecionar" })[0])

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockNavigateToUrl).toHaveBeenCalledWith("https://sandbox.asaas.com/payment-link/retry-success")
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    expect(mockToastError).not.toHaveBeenCalled()
  })

  it("shows the shared checkout error when checkout keeps failing", async () => {
    const user = userEvent.setup()
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Unexpected gateway response" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Unexpected gateway response" }),
      })

    render(
      <PlanUpdateDialog
        isOpen
        onOpenChange={vi.fn()}
        activeRecurringPlan={null}
        currentCredits={4}
      />,
    )

    await user.click(screen.getAllByRole("button", { name: "Selecionar" })[1])

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockToastError).toHaveBeenCalledWith(CHECKOUT_ERROR_MESSAGE)
    })

    expect(mockNavigateToUrl).not.toHaveBeenCalled()
  })

  it("explains the monthly restriction instead of silently disabling the button", async () => {
    const user = userEvent.setup()

    render(
      <PlanUpdateDialog
        isOpen
        onOpenChange={vi.fn()}
        activeRecurringPlan="monthly"
        currentCredits={20}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Ver restrição" }))

    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith(ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE)
  })
})
