import { describe, expect, it } from "vitest"

import { getSafeRedirectPath } from "@/lib/auth/redirects"

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

  it("canonicalizes legacy dashboard redirects", () => {
    expect(getSafeRedirectPath("/dashboard?session=sess_123", "/profile-setup")).toBe(
      "/dashboard/resume/compare/sess_123",
    )
    expect(getSafeRedirectPath("/dashboard/resumes/new", "/chat")).toBe("/profile-setup")
    expect(getSafeRedirectPath("/dashboard/resume/new?source=legacy", "/chat")).toBe(
      "/profile-setup?source=legacy",
    )
    expect(getSafeRedirectPath("/dashboard/resumes/history/", "/chat")).toBe(
      "/dashboard/resumes-history",
    )
  })

  it("canonicalizes profile and chat aliases", () => {
    expect(getSafeRedirectPath("/profile", "/chat")).toBe("/profile-setup")

    const redirectTarget = getSafeRedirectPath("/chat/sess_encoded%20123", "/profile-setup")
    const redirectUrl = new URL(redirectTarget, "http://curria.local")

    expect(redirectUrl.pathname).toBe("/chat")
    expect(redirectUrl.searchParams.get("session")).toBe("sess_encoded 123")
  })
})
