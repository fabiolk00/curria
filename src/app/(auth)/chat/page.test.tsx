import { describe, expect, it, vi } from "vitest"

import ChatPage, { dynamic, revalidate } from "./page"

const mockRedirect = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`)
})

vi.mock("next/navigation", () => ({
  redirect: (path: string) => mockRedirect(path),
}))

describe("ChatPage", () => {
  it("keeps the deprecated route dynamic and uncached", () => {
    expect(dynamic).toBe("force-dynamic")
    expect(revalidate).toBe(0)
  })

  it("redirects retired chat entry to profile setup", () => {
    expect(() => ChatPage({})).toThrow("redirect:/profile-setup")
    expect(mockRedirect).toHaveBeenCalledWith("/profile-setup")
  })

  it("redirects retired chat sessions to resume comparison", () => {
    expect(() => ChatPage({
      searchParams: {
        session: "sess_valid_123",
      },
    })).toThrow("redirect:/dashboard/resume/compare/sess_valid_123")
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/resume/compare/sess_valid_123")
  })

  it("normalizes repeated session params to the first value", () => {
    expect(() => ChatPage({
      searchParams: {
        session: ["sess_first", "sess_second"],
      },
    })).toThrow("redirect:/dashboard/resume/compare/sess_first")
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/resume/compare/sess_first")
  })
})
