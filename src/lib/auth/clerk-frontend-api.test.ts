import { describe, expect, it } from "vitest"

import { decodeClerkFrontendApi } from "./clerk-frontend-api"

describe("decodeClerkFrontendApi", () => {
  it("decodes the frontend API origin from a Clerk publishable key", () => {
    expect(decodeClerkFrontendApi("pk_live_Y2xlcmsuY3VycmlhLmNvbS5iciQ")).toBe("https://clerk.curria.com.br")
  })

  it("returns null for malformed keys", () => {
    expect(decodeClerkFrontendApi("pk_live_not-base64")).toBeNull()
    expect(decodeClerkFrontendApi("")).toBeNull()
    expect(decodeClerkFrontendApi(undefined)).toBeNull()
  })
})
