import React from "react"
import { describe, expect, it, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import ProfileSetupPage from "./page"

const mockGetCurrentAppUser = vi.fn()
const mockLoadOptionalBillingInfo = vi.fn()
const mockCurrentUser = vi.fn()
const mockIsE2EAuthEnabled = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: () => mockCurrentUser(),
}))

vi.mock("@/lib/auth/app-user", () => ({
  getCurrentAppUser: () => mockGetCurrentAppUser(),
}))

vi.mock("@/lib/auth/e2e-auth", () => ({
  isE2EAuthEnabled: () => mockIsE2EAuthEnabled(),
}))

vi.mock("@/lib/asaas/optional-billing-info", () => ({
  loadOptionalBillingInfo: () => mockLoadOptionalBillingInfo(),
}))

vi.mock("@/lib/billing/ai-chat-access.server", () => ({
  getAiChatAccess: () => {
    throw new Error("profile setup must not load AI chat entitlement")
  },
}))

vi.mock("@/components/resume/user-data-page", () => ({
  default: ({
    activeRecurringPlan,
    currentCredits,
    currentAppUserId,
    userImageUrl,
  }: {
    activeRecurringPlan: string | null
    currentCredits: number
    currentAppUserId: string | null
    userImageUrl: string | null
  }) => (
    <div
      data-testid="user-data-page"
      data-active-recurring-plan={activeRecurringPlan ?? ""}
      data-current-credits={String(currentCredits)}
      data-current-app-user-id={currentAppUserId ?? ""}
      data-user-image-url={userImageUrl ?? ""}
    />
  ),
}))

describe("ProfileSetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsE2EAuthEnabled.mockReturnValue(false)
    mockCurrentUser.mockResolvedValue({
      imageUrl: "https://example.com/avatar.png",
    })
  })

  it("renders profile setup for authenticated users without AI chat entitlement", async () => {
    mockGetCurrentAppUser.mockResolvedValue({
      id: "usr_123",
      creditAccount: {
        creditsRemaining: 7,
      },
    })
    mockLoadOptionalBillingInfo.mockResolvedValue({
      billingNotice: null,
      billingInfo: {
        plan: "monthly",
        hasActiveRecurringSubscription: true,
      },
    })

    const jsx = await ProfileSetupPage()
    render(jsx)

    expect(screen.getByTestId("user-data-page")).toHaveAttribute("data-current-app-user-id", "usr_123")
    expect(screen.getByTestId("user-data-page")).toHaveAttribute("data-current-credits", "7")
    expect(screen.getByTestId("user-data-page")).toHaveAttribute("data-active-recurring-plan", "monthly")
    expect(screen.getByTestId("user-data-page")).toHaveAttribute("data-user-image-url", "https://example.com/avatar.png")
  })

  it("renders with no recurring plan when billing data is unavailable", async () => {
    mockGetCurrentAppUser.mockResolvedValue({
      id: "usr_123",
      creditAccount: {
        creditsRemaining: 0,
      },
    })
    mockLoadOptionalBillingInfo.mockResolvedValue({
      billingNotice: "temporarily unavailable",
      billingInfo: null,
    })

    const jsx = await ProfileSetupPage()
    render(jsx)

    expect(screen.getByTestId("user-data-page")).toHaveAttribute("data-active-recurring-plan", "")
    expect(screen.getByTestId("user-data-page")).toHaveAttribute("data-current-credits", "0")
  })
})
