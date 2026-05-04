import { describe, expect, it } from "vitest"

import sitemap, { sitemapRoutes } from "@/app/sitemap"
import { PUBLIC_ROUTES } from "@/lib/routes/public"
import { SEO_LAST_MODIFIED } from "@/lib/seo/site-config"
import { allRoleLandingConfigs } from "@/lib/seo/role-landing-config"

describe("sitemap", () => {
  it("includes all canonical public SEO routes and role landing pages", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.trampofy.com.br"

    const entries = sitemap()
    const urls = entries.map((entry) => entry.url)

    expect(urls).toEqual(
      expect.arrayContaining([
        "https://www.trampofy.com.br/",
        `https://www.trampofy.com.br${PUBLIC_ROUTES.atsGuide}`,
        `https://www.trampofy.com.br${PUBLIC_ROUTES.privacy}`,
        `https://www.trampofy.com.br${PUBLIC_ROUTES.terms}`,
        ...allRoleLandingConfigs.map((config) => `https://www.trampofy.com.br${config.meta.canonical}`),
      ]),
    )
  })

  it("does not include auth or functional-only routes", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.trampofy.com.br"

    const urls = sitemap().map((entry) => entry.url)

    expect(urls).not.toContain(`https://www.trampofy.com.br${PUBLIC_ROUTES.login}`)
    expect(urls).not.toContain(`https://www.trampofy.com.br${PUBLIC_ROUTES.signup}`)
    expect(urls).not.toContain(`https://www.trampofy.com.br${PUBLIC_ROUTES.checkout}`)
    expect(urls).not.toContain("https://www.trampofy.com.br/sso-callback")
  })

  it("uses a stable lastModified value across calls", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.trampofy.com.br"

    const firstRun = sitemap()
    const secondRun = sitemap()

    expect(firstRun).toEqual(secondRun)
    expect(
      firstRun.every(
        (entry) =>
          entry.lastModified != null
          && new Date(entry.lastModified).getTime() === SEO_LAST_MODIFIED.getTime(),
      ),
    ).toBe(true)
  })

  it("generates absolute www URLs for every sitemap entry", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.trampofy.com.br/"

    const urls = sitemap().map((entry) => entry.url)

    expect(urls).toHaveLength(sitemapRoutes.length)
    expect(urls.every((url) => url.startsWith("https://www.trampofy.com.br"))).toBe(true)
  })
})
