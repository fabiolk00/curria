import { describe, expect, it } from "vitest"

import { embeddedClerkAppearance } from "./clerk-appearance"

describe("embeddedClerkAppearance", () => {
  it("styles the input wrapper as the visible field boundary", () => {
    expect(embeddedClerkAppearance.elements.formFieldInputGroup).toContain("rounded-xl")
    expect(embeddedClerkAppearance.elements.formFieldInputGroup).toContain("border")
    expect(embeddedClerkAppearance.elements.formFieldInputGroup).toContain("bg-background")
  })

  it("keeps the inner input transparent so grouped Clerk fields do not clip", () => {
    expect(embeddedClerkAppearance.elements.formFieldInput).toContain("w-full")
    expect(embeddedClerkAppearance.elements.formFieldInput).toContain("border-0")
    expect(embeddedClerkAppearance.elements.formFieldInput).toContain("bg-transparent")
  })
})
