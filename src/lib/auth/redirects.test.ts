import { describe, expect, it } from "vitest"

import { buildSsoCallbackPath, getSafeRedirectPath } from "@/lib/auth/redirects"
import { GENERATE_RESUME_PATH } from "@/lib/routes/app"

describe("getSafeRedirectPath", () => {
  it("falls back when the candidate is missing or external", () => {
    expect(getSafeRedirectPath(undefined, "/profile-setup")).toBe("/profile-setup")
    expect(getSafeRedirectPath("https://curria.app/chat", "/profile-setup")).toBe("/profile-setup")
  })

  it("keeps internal non-legacy routes untouched", () => {
    expect(getSafeRedirectPath("/finalizar-compra?plan=pro", "/profile-setup")).toBe(
      "/finalizar-compra?plan=pro",
    )
  })

  it("builds SSO callback URLs with the safe destination carried through", () => {
    expect(buildSsoCallbackPath("/profile-setup")).toBe(
      "/sso-callback?redirect_to=%2Fprofile-setup",
    )
    expect(buildSsoCallbackPath("/finalizar-compra?plan=pro")).toBe(
      "/sso-callback?redirect_to=%2Ffinalizar-compra%3Fplan%3Dpro",
    )
  })

  it("canonicalizes legacy dashboard redirects", () => {
    expect(getSafeRedirectPath("/dashboard?session=sess_123", "/profile-setup")).toBe(
      "/dashboard/resume/compare/sess_123",
    )
    expect(getSafeRedirectPath("/dashboard/resumes/new", "/chat")).toBe(GENERATE_RESUME_PATH)
    expect(getSafeRedirectPath("/dashboard/resume/new?source=legacy", "/chat")).toBe(
      `${GENERATE_RESUME_PATH}?source=legacy`,
    )
    expect(getSafeRedirectPath("/dashboard/resumes/history/", "/chat")).toBe(
      "/dashboard/resumes-history",
    )
  })

  it("canonicalizes profile and retired chat aliases", () => {
    expect(getSafeRedirectPath("/profile", "/chat")).toBe("/profile-setup")

    const redirectTarget = getSafeRedirectPath("/chat/sess_encoded%20123", "/profile-setup")
    const redirectUrl = new URL(redirectTarget, "http://curria.local")

    expect(redirectUrl.pathname).toBe("/dashboard/resume/compare/sess_encoded%20123")
    expect(redirectUrl.searchParams.get("session")).toBeNull()
  })
})
