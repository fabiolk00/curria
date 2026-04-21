import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import ResumesPage, { dynamic, revalidate } from "./page"

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))

vi.mock("next/navigation", () => ({
  redirect: (path: string) => mockRedirect(path),
}))

describe("ResumesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exports the route as force-dynamic with no revalidation", () => {
    expect(dynamic).toBe("force-dynamic")
    expect(revalidate).toBe(0)
  })

  it("redirects the frontend route back to /dashboard", async () => {
    await expect(ResumesPage()).rejects.toThrow("redirect:/dashboard")
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard")
  })
})
