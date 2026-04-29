import { describe, expect, it } from "vitest"

import {
  buildResumeComparisonPath,
  canonicalizeAppPath,
  PROFILE_SETUP_PATH,
} from "./app"

describe("app route helpers", () => {
  it("canonicalizes the legacy dashboard root to profile setup", () => {
    expect(canonicalizeAppPath("/dashboard")).toBe(PROFILE_SETUP_PATH)
  })

  it("canonicalizes legacy dashboard session links to resume comparison", () => {
    expect(canonicalizeAppPath("/dashboard?session=sess_123")).toBe("/dashboard/resume/compare/sess_123")
  })

  it("canonicalizes retired chat links to generation surfaces", () => {
    expect(canonicalizeAppPath("/chat")).toBe(PROFILE_SETUP_PATH)
    expect(canonicalizeAppPath("/chat?session=sess_123")).toBe("/dashboard/resume/compare/sess_123")
    expect(canonicalizeAppPath("/chat/sess_123")).toBe("/dashboard/resume/compare/sess_123")
  })

  it("builds resume comparison paths for historical sessions", () => {
    expect(buildResumeComparisonPath("sess_123")).toBe("/dashboard/resume/compare/sess_123")
  })
})
