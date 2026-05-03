import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import SignupForm from "./signup-form"

const {
  mockSearchParamsGet,
  mockNavigateToUrl,
  mockIsLoaded,
  mockIsSignedIn,
  mockSignUpCreate,
  mockSignUpAuthenticateWithRedirect,
  mockPrepareEmailAddressVerification,
  mockAttemptEmailAddressVerification,
  mockValidatePassword,
  mockSetActive,
  mockSignUpState,
  mockClerkState,
} = vi.hoisted(() => ({
  mockSearchParamsGet: vi.fn(),
  mockNavigateToUrl: vi.fn(),
  mockIsLoaded: vi.fn(),
  mockIsSignedIn: vi.fn(),
  mockSignUpCreate: vi.fn(),
  mockSignUpAuthenticateWithRedirect: vi.fn(),
  mockPrepareEmailAddressVerification: vi.fn(),
  mockAttemptEmailAddressVerification: vi.fn(),
  mockValidatePassword: vi.fn(),
  mockSetActive: vi.fn(),
  mockSignUpState: {
    isLoaded: true,
    signUp: {
      create: vi.fn(),
      authenticateWithRedirect: vi.fn(),
      prepareEmailAddressVerification: vi.fn(),
      attemptEmailAddressVerification: vi.fn(),
      validatePassword: vi.fn(),
    },
    setActive: vi.fn(),
  },
  mockClerkState: {
    client: {
      passwordSettings: {
        min_length: 8,
        require_special_char: true,
      },
    },
  },
}))

mockSignUpState.signUp.create = mockSignUpCreate
mockSignUpState.signUp.authenticateWithRedirect = mockSignUpAuthenticateWithRedirect
mockSignUpState.signUp.prepareEmailAddressVerification = mockPrepareEmailAddressVerification
mockSignUpState.signUp.attemptEmailAddressVerification = mockAttemptEmailAddressVerification
mockSignUpState.signUp.validatePassword = mockValidatePassword
mockSignUpState.setActive = mockSetActive

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: mockIsLoaded(),
    isSignedIn: mockIsSignedIn(),
  }),
  useSignUp: () => mockSignUpState,
  useClerk: () => mockClerkState,
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
}))

vi.mock("@/lib/navigation/external", () => ({
  navigateToUrl: mockNavigateToUrl,
}))

describe("SignupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParamsGet.mockReturnValue(null)
    mockIsLoaded.mockReturnValue(true)
    mockIsSignedIn.mockReturnValue(false)
    mockSignUpCreate.mockResolvedValue({
      status: "complete",
      createdSessionId: "sess_signup",
    })
    mockSignUpAuthenticateWithRedirect.mockResolvedValue(undefined)
    mockPrepareEmailAddressVerification.mockResolvedValue(undefined)
    mockAttemptEmailAddressVerification.mockResolvedValue({
      status: "complete",
      createdSessionId: "sess_verified",
    })
    mockValidatePassword.mockImplementation(
      (password: string, callbacks?: { onValidation?: (value: { complexity?: Record<string, boolean> }) => void }) => {
        callbacks?.onValidation?.({
          complexity: {
            min_length: password.length < 8,
            require_special_char: !/[^A-Za-z0-9]/.test(password),
          },
        })
      },
    )
    mockSetActive.mockResolvedValue(undefined)
  })

  it("renders the custom signup fields", () => {
    render(<SignupForm />)

    expect(screen.getByLabelText("Primeiro nome")).toBeInTheDocument()
    expect(screen.getByLabelText("Sobrenome")).toBeInTheDocument()
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument()
    expect(screen.getByLabelText("Senha")).toBeInTheDocument()
    expect(screen.getByText("Mínimo de 8 caracteres")).toBeInTheDocument()
    expect(screen.getByText("Pelo menos 1 caractere especial")).toBeInTheDocument()
  })

  it("submits signup data and redirects to onboarding by default", async () => {
    const user = userEvent.setup()

    render(<SignupForm />)

    await user.type(screen.getByLabelText("Primeiro nome"), "Ana")
    await user.type(screen.getByLabelText("Sobrenome"), "Teste")
    await user.type(screen.getByLabelText("E-mail"), "ana@example.com")
    await user.type(screen.getByLabelText("Senha"), "super-secret")
    await user.click(screen.getByRole("button", { name: /^Continuar$/i }))

    await waitFor(() => {
      expect(mockSignUpCreate).toHaveBeenCalledWith({
        firstName: "Ana",
        lastName: "Teste",
        emailAddress: "ana@example.com",
        password: "super-secret",
      })
    })

    await waitFor(() => {
      expect(mockSetActive).toHaveBeenCalledWith({ session: "sess_signup" })
      expect(mockNavigateToUrl).toHaveBeenCalledWith("/profile-setup")
    })
  })

  it("respects redirect_to after email signup", async () => {
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "redirect_to" ? "/finalizar-compra?plan=monthly" : null,
    )
    const user = userEvent.setup()

    render(<SignupForm />)

    await user.type(screen.getByLabelText("Primeiro nome"), "Ana")
    await user.type(screen.getByLabelText("Sobrenome"), "Teste")
    await user.type(screen.getByLabelText("E-mail"), "ana@example.com")
    await user.type(screen.getByLabelText("Senha"), "super-secret")
    await user.click(screen.getByRole("button", { name: /^Continuar$/i }))

    await waitFor(() => {
      expect(mockSetActive).toHaveBeenCalledWith({ session: "sess_signup" })
      expect(mockNavigateToUrl).toHaveBeenCalledWith("/finalizar-compra?plan=monthly")
    })
  })

  it("starts the Google signup flow with profile setup by default", async () => {
    const user = userEvent.setup()

    render(<SignupForm />)

    await user.click(screen.getByRole("button", { name: "Continuar com Google" }))

    await waitFor(() => {
      expect(mockSignUpAuthenticateWithRedirect).toHaveBeenCalledWith({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback?redirect_to=%2Fprofile-setup",
        redirectUrlComplete: "/profile-setup",
      })
    })
  })

  it("passes redirect_to to the Google signup flow", async () => {
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "redirect_to" ? "/finalizar-compra?plan=monthly" : null,
    )
    const user = userEvent.setup()

    render(<SignupForm />)

    await user.click(screen.getByRole("button", { name: "Continuar com Google" }))

    await waitFor(() => {
      expect(mockSignUpAuthenticateWithRedirect).toHaveBeenCalledWith({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback?redirect_to=%2Ffinalizar-compra%3Fplan%3Dmonthly",
        redirectUrlComplete: "/finalizar-compra?plan=monthly",
      })
    })
  })

  it("redirects authenticated visitors away from signup using the requested path", async () => {
    mockIsSignedIn.mockReturnValue(true)
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "redirect_to" ? "/finalizar-compra?plan=pro" : null,
    )

    render(<SignupForm />)

    await waitFor(() => {
      expect(mockNavigateToUrl).toHaveBeenCalledWith("/finalizar-compra?plan=pro")
    })
  })

  it("shows the email verification step when Clerk requires verification", async () => {
    const user = userEvent.setup()
    mockSignUpCreate.mockResolvedValue({
      status: "missing_requirements",
      createdSessionId: null,
    })

    render(<SignupForm />)

    await user.type(screen.getByLabelText("Primeiro nome"), "Ana")
    await user.type(screen.getByLabelText("Sobrenome"), "Teste")
    await user.type(screen.getByLabelText("E-mail"), "ana@example.com")
    await user.type(screen.getByLabelText("Senha"), "super-secret")
    await user.click(screen.getByRole("button", { name: /^Continuar$/i }))

    await waitFor(() => {
      expect(mockPrepareEmailAddressVerification).toHaveBeenCalledWith({
        strategy: "email_code",
      })
    })

    expect(screen.getByLabelText("Código")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Verificar" })).toBeInTheDocument()
  })
})
