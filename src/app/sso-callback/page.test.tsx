import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"

import SSOCallback from "./page"

vi.mock("@clerk/nextjs", () => ({
  AuthenticateWithRedirectCallback: (props: {
    signInFallbackRedirectUrl?: string
    signInForceRedirectUrl?: string
    signUpFallbackRedirectUrl?: string
    signUpForceRedirectUrl?: string
  }) => (
    <div
      data-testid="sso-callback"
      data-sign-in-fallback={props.signInFallbackRedirectUrl}
      data-sign-in-force={props.signInForceRedirectUrl}
      data-sign-up-fallback={props.signUpFallbackRedirectUrl}
      data-sign-up-force={props.signUpForceRedirectUrl}
    />
  ),
}))

describe("SSOCallback", () => {
  it("forces Google OAuth completion to the carried safe redirect", () => {
    render(
      <SSOCallback
        searchParams={{
          redirect_to: "/finalizar-compra?plan=pro",
        }}
      />,
    )

    expect(screen.getByTestId("sso-callback")).toHaveAttribute(
      "data-sign-in-force",
      "/finalizar-compra?plan=pro",
    )
    expect(screen.getByTestId("sso-callback")).toHaveAttribute(
      "data-sign-up-force",
      "/finalizar-compra?plan=pro",
    )
  })

  it("falls back to profile setup for unsafe redirects", () => {
    render(
      <SSOCallback
        searchParams={{
          redirect_to: "https://example.com",
        }}
      />,
    )

    expect(screen.getByTestId("sso-callback")).toHaveAttribute(
      "data-sign-in-fallback",
      "/profile-setup",
    )
    expect(screen.getByTestId("sso-callback")).toHaveAttribute(
      "data-sign-up-fallback",
      "/profile-setup",
    )
  })
})
