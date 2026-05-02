import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import React from "react"
import { describe, expect, it, vi } from "vitest"

import AuthShell from "./auth-shell"

vi.mock("@/components/logo", () => ({
  default: ({ linkTo }: { linkTo: string }) => <a href={linkTo}>CurrIA</a>,
}))

describe("AuthShell", () => {
  it("preserves a safe redirect_to when switching between login and signup", () => {
    render(
      <AuthShell
        mode="login"
        title="Entrar"
        description=""
        redirectTo="/finalizar-compra?plan=monthly"
      >
        <div>Form</div>
      </AuthShell>,
    )

    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "/entrar?redirect_to=%2Ffinalizar-compra%3Fplan%3Dmonthly",
    )
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute(
      "href",
      "/criar-conta?redirect_to=%2Ffinalizar-compra%3Fplan%3Dmonthly",
    )
  })

  it("does not preserve unsafe redirect_to values in auth mode links", () => {
    render(
      <AuthShell
        mode="signup"
        title="Criar conta"
        description=""
        redirectTo="https://example.com"
      >
        <div>Form</div>
      </AuthShell>,
    )

    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/entrar")
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/criar-conta")
  })
})
