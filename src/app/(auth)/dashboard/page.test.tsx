import React from "react"
import { describe, expect, it, vi } from "vitest"

import DashboardPage, { dynamic, revalidate } from "./page"

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))

vi.mock("next/navigation", () => ({
  redirect: (path: string) => mockRedirect(path),
}))

describe("DashboardPage", () => {
  it("exports the dashboard redirect route as force-dynamic with no revalidation", () => {
    expect(dynamic).toBe("force-dynamic")
    expect(revalidate).toBe(0)
  })

  it("redirects /dashboard to guided profile setup when no session query is present", async () => {
    await expect(DashboardPage({})).rejects.toThrow("redirect:/profile-setup")
    expect(mockRedirect).toHaveBeenCalledWith("/profile-setup")
  })

  it("routes a session query to resume comparison", async () => {
    await expect(DashboardPage({
      searchParams: {
        session: "sess_valid_123",
      },
    })).rejects.toThrow("redirect:/dashboard/resume/compare/sess_valid_123")

    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/resume/compare/sess_valid_123")
  })

  it("normalizes repeated session params to the first value", async () => {
    await expect(DashboardPage({
      searchParams: {
        session: ["sess_first", "sess_second"],
      },
    })).rejects.toThrow("redirect:/dashboard/resume/compare/sess_first")

    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/resume/compare/sess_first")
  })
})
