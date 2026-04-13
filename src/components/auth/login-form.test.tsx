import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import LoginForm from "./login-form"

const {
  mockCreate,
  mockAuthenticateWithRedirect,
  mockSetActive,
  mockNavigateToUrl,
} = vi.hoisted(() => ({
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

vi.mock("@/lib/navigation/external", () => ({
  navigateToUrl: mockNavigateToUrl,
}))

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it("submits email and password through Clerk and always redirects to the new resume flow", async () => {
    const user = userEvent.setup()

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
      expect(mockNavigateToUrl).toHaveBeenCalledWith("/dashboard/resumes/new")
    })
  })

  it("starts the Google redirect flow with the new resume destination", async () => {
    const user = userEvent.setup()

    render(<LoginForm />)

    await user.click(screen.getByRole("button", { name: "Continuar com Google" }))

    await waitFor(() => {
      expect(mockAuthenticateWithRedirect).toHaveBeenCalledWith({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard/resumes/new",
      })
    })
  })
})
