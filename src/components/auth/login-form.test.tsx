import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import React from "react"

import LoginForm from "./login-form"

const { mockSignIn, mockNavigateToUrl, mockIsSignedIn, mockSearchParamsGet, mockIsLoaded } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockNavigateToUrl: vi.fn(),
  mockIsSignedIn: vi.fn(),
  mockSearchParamsGet: vi.fn(),
  mockIsLoaded: vi.fn(),
}))

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isSignedIn: mockIsSignedIn(),
  }),
  useSignIn: () => ({
    isLoaded: mockIsLoaded(),
    signIn: {
      create: mockSignIn,
      authenticateWithRedirect: vi.fn(),
    },
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

vi.mock("@/components/logo", () => ({
  default: () => <div>Logo</div>,
}))

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsSignedIn.mockReturnValue(false)
    mockSearchParamsGet.mockReturnValue(null)
    mockIsLoaded.mockReturnValue(true)
  })

  it("renders the login form", () => {
    render(<LoginForm />)

    expect(screen.getByText("Entrar na sua conta")).toBeInTheDocument()
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument()
    expect(screen.getByLabelText("Senha")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^entrar$/i })).toBeInTheDocument()
  })

  it("has noValidate attribute on form", () => {
    const { container } = render(<LoginForm />)
    const form = container.querySelector("form")

    expect(form).toHaveAttribute("noValidate")
  })

  it("submits form when valid data is entered", async () => {
    mockSignIn.mockResolvedValue({ status: "complete" })
    const user = userEvent.setup()

    render(<LoginForm />)

    const emailInput = screen.getByLabelText("E-mail")
    const passwordInput = screen.getByLabelText("Senha")
    const submitButton = screen.getByRole("button", { name: /^entrar$/i })

    await user.type(emailInput, "test@example.com")
    await user.type(passwordInput, "password123")
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        identifier: "test@example.com",
        password: "password123",
      })
    })

    await waitFor(() => {
      expect(mockNavigateToUrl).toHaveBeenCalledWith("/dashboard")
    })
  })

  it("redirects to the requested safe path after sign in", async () => {
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "redirect_to" ? "/pricing?checkoutPlan=monthly" : null,
    )
    mockSignIn.mockResolvedValue({ status: "complete" })
    const user = userEvent.setup()

    render(<LoginForm />)

    await user.type(screen.getByLabelText("E-mail"), "test@example.com")
    await user.type(screen.getByLabelText("Senha"), "password123")
    await user.click(screen.getByRole("button", { name: /^entrar$/i }))

    await waitFor(() => {
      expect(mockNavigateToUrl).toHaveBeenCalledWith("/pricing?checkoutPlan=monthly")
    })
  })

  it("shows error when email is invalid", async () => {
    const user = userEvent.setup()

    render(<LoginForm />)

    const emailInput = screen.getByLabelText("E-mail")
    const passwordInput = screen.getByLabelText("Senha")
    const submitButton = screen.getByRole("button", { name: /^entrar$/i })

    await user.type(emailInput, "invalid")
    await user.type(passwordInput, "password123")
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText("E-mail inválido")).toBeInTheDocument()
    })
  })

  it("shows error when password is too short", async () => {
    const user = userEvent.setup()

    render(<LoginForm />)

    const emailInput = screen.getByLabelText("E-mail")
    const passwordInput = screen.getByLabelText("Senha")
    const submitButton = screen.getByRole("button", { name: /^entrar$/i })

    await user.type(emailInput, "test@example.com")
    await user.type(passwordInput, "short")
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText("Senha deve ter pelo menos 8 caracteres")).toBeInTheDocument()
    })
  })

  it("disables submit button while submitting", async () => {
    mockSignIn.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ status: "complete" }), 100)),
    )
    const user = userEvent.setup()

    render(<LoginForm />)

    const emailInput = screen.getByLabelText("E-mail")
    const passwordInput = screen.getByLabelText("Senha")
    const submitButton = screen.getByRole("button", { name: /^entrar$/i })

    await user.type(emailInput, "test@example.com")
    await user.type(passwordInput, "password123")
    await user.click(submitButton)

    await waitFor(() => {
      expect(submitButton).toBeDisabled()
    })
  })

  it("disables email sign in and shows loading feedback while Clerk is not ready", () => {
    mockIsLoaded.mockReturnValue(false)

    render(<LoginForm />)

    expect(screen.getByRole("button", { name: /carregando/i })).toBeDisabled()
    expect(screen.getByText(/Carregando autenticação/i)).toBeInTheDocument()
  })

  it("redirects authenticated visitors away from login", async () => {
    mockIsSignedIn.mockReturnValue(true)
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "redirect_to" ? "/pricing?checkoutPlan=monthly" : null,
    )

    render(<LoginForm />)

    await waitFor(() => {
      expect(mockNavigateToUrl).toHaveBeenCalledWith("/pricing?checkoutPlan=monthly")
    })
  })

  it("resumes the requested path when Clerk reports an existing session during sign in", async () => {
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "redirect_to" ? "/pricing?checkoutPlan=monthly" : null,
    )
    mockSignIn.mockRejectedValue({
      errors: [{ code: "session_exists", message: "Session already exists" }],
    })
    const user = userEvent.setup()

    render(<LoginForm />)

    await user.type(screen.getByLabelText("E-mail"), "test@example.com")
    await user.type(screen.getByLabelText("Senha"), "password123")
    await user.click(screen.getByRole("button", { name: /^entrar$/i }))

    await waitFor(() => {
      expect(mockNavigateToUrl).toHaveBeenCalledWith("/pricing?checkoutPlan=monthly")
    })
  })
})
