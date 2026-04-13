import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import LoginForm from "./login-form"

const {
  mockSearchParamsGet,
  mockCreate,
  mockAuthenticateWithRedirect,
  mockSetActive,
  mockNavigateToUrl,
} = vi.hoisted(() => ({
  mockSearchParamsGet: vi.fn(),
  mockCreate: vi.fn(),
  mockAuthenticateWithRedirect: vi.fn(),
  mockSetActive: vi.fn(),
  mockNavigateToUrl: vi.fn(),
}))

vi.mock("@clerk/nextjs", () => ({
  useSignIn: () => ({
    isLoaded: true,
    signIn: {
      create: mockCreate,
      authenticateWithRedirect: mockAuthenticateWithRedirect,
    },
    setActive: mockSetActive,
  }),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
}))

vi.mock("@/lib/navigation/external", () => ({
  navigateToUrl: mockNavigateToUrl,
}))

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParamsGet.mockReturnValue(null)
    mockCreate.mockResolvedValue({
      status: "complete",
      createdSessionId: "sess_123",
    })
    mockAuthenticateWithRedirect.mockResolvedValue(undefined)
    mockSetActive.mockResolvedValue(undefined)
  })

  it("renders the custom login fields", () => {
    render(<LoginForm />)

    expect(screen.getByLabelText("E-mail")).toBeInTheDocument()
    expect(screen.getByLabelText("Senha")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continuar com Google" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Continuar$/i })).toBeInTheDocument()
  })

  it("submits email and password through Clerk and redirects safely", async () => {
    const user = userEvent.setup()
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "redirect_to" ? "/pricing?checkoutPlan=monthly" : null,
    )

    render(<LoginForm />)

    await user.type(screen.getByLabelText("E-mail"), "ana@example.com")
    await user.type(screen.getByLabelText("Senha"), "super-secret")
    await user.click(screen.getByRole("button", { name: /^Continuar$/i }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        strategy: "password",
        identifier: "ana@example.com",
        password: "super-secret",
      })
    })

    await waitFor(() => {
      expect(mockSetActive).toHaveBeenCalledWith({ session: "sess_123" })
      expect(mockNavigateToUrl).toHaveBeenCalledWith("/pricing?checkoutPlan=monthly")
    })
  })

  it("starts the Google redirect flow with the safe redirect target", async () => {
    const user = userEvent.setup()
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "redirect_to" ? "/dashboard" : null,
    )

    render(<LoginForm />)

    await user.click(screen.getByRole("button", { name: "Continuar com Google" }))

    await waitFor(() => {
      expect(mockAuthenticateWithRedirect).toHaveBeenCalledWith({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      })
    })
  })
})
