import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import SignupForm from "./signup-form"
import { buildDefaultCheckoutOnboardingPath } from "@/lib/billing/checkout-navigation"

const { mockSearchParamsGet, mockNavigateToUrl, mockIsLoaded, mockIsSignedIn, mockSignUpProps } = vi.hoisted(() => ({
  mockSearchParamsGet: vi.fn(),
  mockNavigateToUrl: vi.fn(),
  mockIsLoaded: vi.fn(),
  mockIsSignedIn: vi.fn(),
  mockSignUpProps: vi.fn(),
}))

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: mockIsLoaded(),
    isSignedIn: mockIsSignedIn(),
  }),
  SignUp: (props: unknown) => {
    mockSignUpProps(props)
    return <div data-testid="clerk-sign-up">Clerk SignUp</div>
  },
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
}))

vi.mock("@/lib/navigation/external", () => ({
  navigateToUrl: mockNavigateToUrl,
}))

vi.mock("@/components/logo", () => ({
  default: () => <div>Logo</div>,
}))

describe("SignupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParamsGet.mockReturnValue(null)
    mockIsLoaded.mockReturnValue(true)
    mockIsSignedIn.mockReturnValue(false)
  })

  it("renders the embedded Clerk sign up component inside the branded shell", () => {
    render(<SignupForm />)

    expect(screen.getByText("Logo")).toBeInTheDocument()
    expect(screen.getByTestId("clerk-sign-up")).toBeInTheDocument()
  })

  it("passes the default onboarding redirect to Clerk when no redirect_to is provided", () => {
    render(<SignupForm />)

    expect(mockSignUpProps).toHaveBeenCalledWith(
      expect.objectContaining({
        routing: "hash",
        forceRedirectUrl: buildDefaultCheckoutOnboardingPath(),
        signInUrl: "/login",
      }),
    )
  })

  it("redirects authenticated visitors away from signup using the requested path", async () => {
    mockIsSignedIn.mockReturnValue(true)
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "redirect_to" ? "/pricing?checkoutPlan=pro" : null,
    )

    render(<SignupForm />)

    await waitFor(() => {
      expect(mockNavigateToUrl).toHaveBeenCalledWith("/pricing?checkoutPlan=pro")
    })
  })
})
