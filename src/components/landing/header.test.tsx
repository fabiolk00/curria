import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import Header from "./header"

const {
  mockIsLoaded,
  mockIsSignedIn,
  mockTheme,
  mockSetTheme,
} = vi.hoisted(() => ({
  mockIsLoaded: vi.fn(),
  mockIsSignedIn: vi.fn(),
  mockTheme: vi.fn(),
  mockSetTheme: vi.fn(),
}))

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: mockIsLoaded(),
    isSignedIn: mockIsSignedIn(),
  }),
  UserButton: () => <div>Perfil</div>,
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockTheme(),
    setTheme: mockSetTheme,
  }),
}))

vi.mock("@/components/logo", () => ({
  default: () => <div>Logo</div>,
}))

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsLoaded.mockReturnValue(true)
    mockIsSignedIn.mockReturnValue(false)
    mockTheme.mockReturnValue("light")
  })

  it("shows login and signup actions while Clerk is still loading", () => {
    mockIsLoaded.mockReturnValue(false)

    render(<Header />)

    expect(screen.getByRole("link", { name: "Entrar" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Criar conta" })).toBeInTheDocument()
  })

  it("shows the user menu once Clerk is loaded and the user is signed in", () => {
    mockIsSignedIn.mockReturnValue(true)

    render(<Header />)

    expect(screen.getByText("Perfil")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument()
  })
})
