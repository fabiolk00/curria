import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

import { ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE } from "@/lib/asaas/checkout-errors"

import { PlanUpdateDialog } from "./plan-update-dialog"

const { mockPush, mockToastError, mockToastInfo } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockToastError: vi.fn(),
  mockToastInfo: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
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

  it("closes the modal and redirects to pricing checkout for the selected plan", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <PlanUpdateDialog
        isOpen
        onOpenChange={onOpenChange}
        activeRecurringPlan={null}
        currentCredits={4}
      />,
    )

    await user.click(screen.getAllByRole("button", { name: "Selecionar" })[0])

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockPush).toHaveBeenCalledWith("/pricing?checkoutPlan=unit")
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it("explains the monthly restriction instead of navigating when another monthly plan is blocked", async () => {
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

    expect(mockPush).not.toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith(ACTIVE_MONTHLY_PLAN_ERROR_MESSAGE)
  })

  it("disables the current active monthly plan button", () => {
    render(
      <PlanUpdateDialog
        isOpen
        onOpenChange={vi.fn()}
        activeRecurringPlan="pro"
        currentCredits={50}
      />,
    )

    expect(screen.getByRole("button", { name: "Plano atual" })).toBeDisabled()
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockToastInfo).not.toHaveBeenCalled()
  })
})
