import { describe, expect, it } from "vitest"

import sitemap from "@/app/sitemap"
import { PUBLIC_ROUTES } from "@/lib/routes/public"
import { allRoleLandingConfigs } from "@/lib/seo/role-landing-config"

describe("sitemap", () => {
  it("includes all canonical public marketing routes and role landing pages", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.curria.com.br"

    const entries = sitemap()
    const urls = entries.map((entry) => entry.url)

    expect(urls).toEqual(
      expect.arrayContaining([
        "https://www.curria.com.br/",
        `https://www.curria.com.br${PUBLIC_ROUTES.atsGuide}`,
        `https://www.curria.com.br${PUBLIC_ROUTES.pricing}`,
        `https://www.curria.com.br${PUBLIC_ROUTES.login}`,
        `https://www.curria.com.br${PUBLIC_ROUTES.signup}`,
        `https://www.curria.com.br${PUBLIC_ROUTES.privacy}`,
        `https://www.curria.com.br${PUBLIC_ROUTES.terms}`,
        ...allRoleLandingConfigs.map((config) => `https://www.curria.com.br${config.meta.canonical}`),
      ]),
    )
  })

  it("does not include redirects, auth callback routes, or checkout flow pages", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.curria.com.br"

    const urls = sitemap().map((entry) => entry.url)

    expect(urls).not.toContain(`https://www.curria.com.br${PUBLIC_ROUTES.checkout}`)
    expect(urls).not.toContain("https://www.curria.com.br/sso-callback")
  })
})
