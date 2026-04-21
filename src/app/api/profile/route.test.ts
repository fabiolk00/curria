import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { GET, PATCH } from "./route"
import { getCurrentAppUser } from "@/lib/auth/app-user"
import { getExistingUserProfile } from "@/lib/profile/user-profiles"
import {
  getDashboardWelcomeGuideSeen,
  setDashboardWelcomeGuideSeen,
} from "@/lib/users/dashboard-preferences"

vi.mock("@/lib/auth/app-user", () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock("@/lib/profile/user-profiles", () => ({
  getExistingUserProfile: vi.fn(),
}))

vi.mock("@/lib/users/dashboard-preferences", () => ({
  getDashboardWelcomeGuideSeen: vi.fn(),
  setDashboardWelcomeGuideSeen: vi.fn(),
}))

vi.mock("@/lib/observability/structured-log", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}))

function makeTrustedPatchRequest(body: unknown, origin = "http://localhost") {
  return new NextRequest("http://localhost/api/profile", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      origin,
    },
    body: JSON.stringify(body),
  })
}

describe("profile route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the backend welcome-guide flag even when no profile exists", async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: "usr_123" } as never)
    vi.mocked(getExistingUserProfile).mockResolvedValue(null)
    vi.mocked(getDashboardWelcomeGuideSeen).mockResolvedValue(false)

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      profile: null,
      dashboardWelcomeGuideSeen: false,
    })
  })

  it("returns the stored backend welcome-guide flag alongside the profile payload", async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: "usr_123" } as never)
    vi.mocked(getDashboardWelcomeGuideSeen).mockResolvedValue(true)
    vi.mocked(getExistingUserProfile).mockResolvedValue({
      id: "profile_123",
      user_id: "usr_123",
      cv_state: {
        fullName: "Ana Silva",
        email: "ana@example.com",
        phone: "555-0100",
        summary: "Resumo",
        experience: [],
        skills: ["TypeScript"],
        education: [],
      },
      source: "manual",
      linkedin_url: null,
      profile_photo_url: null,
      extracted_at: "2026-04-21T00:00:00.000Z",
      created_at: "2026-04-21T00:00:00.000Z",
      updated_at: "2026-04-21T00:00:00.000Z",
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.dashboardWelcomeGuideSeen).toBe(true)
    expect(json.profile.id).toBe("profile_123")
  })

  it("updates the backend welcome-guide flag through PATCH", async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: "usr_123" } as never)
    vi.mocked(setDashboardWelcomeGuideSeen).mockResolvedValue(true)

    const response = await PATCH(makeTrustedPatchRequest({ dashboardWelcomeGuideSeen: true }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ dashboardWelcomeGuideSeen: true })
    expect(setDashboardWelcomeGuideSeen).toHaveBeenCalledWith("usr_123", true)
  })

  it("rejects cross-origin welcome-guide preference updates", async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({ id: "usr_123" } as never)

    const response = await PATCH(
      makeTrustedPatchRequest({ dashboardWelcomeGuideSeen: true }, "https://evil.example"),
    )

    expect(response.status).toBe(403)
  })
})
