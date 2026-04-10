import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import LoginForm from "./login-form"

const { mockSearchParamsGet, mockSignInProps } = vi.hoisted(() => ({
  mockSearchParamsGet: vi.fn(),
  mockSignInProps: vi.fn(),
}))

vi.mock("@clerk/nextjs", () => ({
  SignIn: (props: unknown) => {
    mockSignInProps(props)
    return <div data-testid="clerk-sign-in">Clerk SignIn</div>
  },
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
}))

vi.mock("@/components/logo", () => ({
  default: () => <div>Logo</div>,
}))

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParamsGet.mockReturnValue(null)
  })

  it("renders the embedded Clerk sign in component inside the branded shell", () => {
    render(<LoginForm />)

    expect(screen.getByText("Logo")).toBeInTheDocument()
    expect(screen.getByTestId("clerk-sign-in")).toBeInTheDocument()
  })

  it("passes the safe redirect path into the embedded Clerk sign in flow", () => {
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "redirect_to" ? "/pricing?checkoutPlan=monthly" : null,
    )

    render(<LoginForm />)

    expect(mockSignInProps).toHaveBeenCalledWith(
      expect.objectContaining({
        routing: "hash",
        forceRedirectUrl: "/pricing?checkoutPlan=monthly",
        signUpUrl: "/signup",
      }),
    )
  })
})
